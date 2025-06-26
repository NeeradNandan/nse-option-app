import React, { useState, useEffect, useCallback, useRef } from 'react';
import './index.css'; // We'll create this CSS file

function OptionChainTable({ expiry = '26-Jun-2025' }) {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [expiryOptions, setExpiryOptions] = useState([]);
	const [selectedExpiry, setSelectedExpiry] = useState(expiry);
	const [niftySpot, setNiftySpot] = useState(null);
	const [niftyATM, setNiftyATM] = useState(null);
	const [ranges, setRanges] = useState({
		                                     c_low: null,
		                                     c_high: null,
		                                     p_low: null,
		                                     p_high: null
	                                     });
	
	// Store historical volume data
	const volumeHistory = useRef(new Map());
	const lastUpdateTime = useRef(Date.now());
	
	// Time intervals in minutes
	const intervals = [1, 3, 6, 12, 18, 24, 30];
	
	// Calculate NIFTY ATM value
	const calculateNiftyATM = (spotPrice) => {
		if (!spotPrice) return null;
		
		// Remove decimal values
		const spotInt = Math.floor(spotPrice);
		
		// Get last two digits
		const lastTwoDigits = spotInt % 100;
		
		// Base value (removing last two digits)
		const baseValue = spotInt - lastTwoDigits;
		
		let atmValue;
		
		if (lastTwoDigits > 0 && lastTwoDigits <= 30) {
			// Just use the base value
			atmValue = baseValue;
		} else if (lastTwoDigits > 30 && lastTwoDigits < 70) {
			// Base value + 50
			atmValue = baseValue + 50;
		} else if (lastTwoDigits >= 70) {
			// Base value + 100
			atmValue = baseValue + 100;
		} else {
			// When lastTwoDigits is 0
			atmValue = baseValue;
		}
		
		return atmValue;
	};
	
	// Calculate ranges based on ATM
	const calculateRanges = (atmValue) => {
		if (!atmValue) return null;
		
		return {
			c_low: atmValue - 250,
			c_high: atmValue - 150,
			p_low: atmValue + 150,
			p_high: atmValue + 250
		};
	};
	
	// Get row class based on strike price
	const getRowClass = (strikePrice) => {
		if (!ranges.c_low) return '';
		
		if (strikePrice === ranges.c_low) return 'highlight-c-low';
		if (strikePrice === ranges.c_high) return 'highlight-c-high';
		if (strikePrice === ranges.p_low) return 'highlight-p-low';
		if (strikePrice === ranges.p_high) return 'highlight-p-high';
		if (strikePrice === niftyATM) return 'highlight-atm';
		
		return '';
	};
	
	const calculateIntervalVolumes = useCallback((currentData, prevData) => {
		const now = Date.now();
		const intervalVolumes = new Map();
		
		currentData.forEach(item => {
			const strikePrice = item.strikePrice;
			const currentCeVol = item.CE?.totalTradedVolume ?? 0;
			const currentPeVol = item.PE?.totalTradedVolume ?? 0;
			
			// Initialize history for this strike if not exists
			if (!volumeHistory.current.has(strikePrice)) {
				volumeHistory.current.set(strikePrice, {
					timestamps: [],
					ceVolumes: [],
					peVolumes: []
				});
			}
			
			const history = volumeHistory.current.get(strikePrice);
			
			// Add current data point
			history.timestamps.push(now);
			history.ceVolumes.push(currentCeVol);
			history.peVolumes.push(currentPeVol);
			
			// Keep only last 30 minutes of data
			const thirtyMinutesAgo = now - (30 * 60 * 1000);
			let firstValidIndex = history.timestamps.findIndex(t => t >= thirtyMinutesAgo);
			if (firstValidIndex > 0) {
				history.timestamps = history.timestamps.slice(firstValidIndex);
				history.ceVolumes = history.ceVolumes.slice(firstValidIndex);
				history.peVolumes = history.peVolumes.slice(firstValidIndex);
			}
			
			// Calculate interval volumes
			const strikeIntervalVolumes = {};
			
			intervals.forEach(minutes => {
				const intervalMs = minutes * 60 * 1000;
				const intervalStartTime = now - intervalMs;
				
				// Find the data point closest to interval start
				let startIndex = 0;
				for (let i = history.timestamps.length - 1; i >= 0; i--) {
					if (history.timestamps[i] <= intervalStartTime) {
						startIndex = i;
						break;
					}
				}
				
				// Calculate volume difference
				const startCeVol = startIndex < history.ceVolumes.length ? history.ceVolumes[startIndex] : history.ceVolumes[0];
				const startPeVol = startIndex < history.peVolumes.length ? history.peVolumes[startIndex] : history.peVolumes[0];
				
				const ceVolumeDiff = currentCeVol - startCeVol;
				const peVolumeDiff = currentPeVol - startPeVol;
				
				strikeIntervalVolumes[`ce${minutes}min`] = ceVolumeDiff >= 0 ? ceVolumeDiff : 0;
				strikeIntervalVolumes[`pe${minutes}min`] = peVolumeDiff >= 0 ? peVolumeDiff : 0;
			});
			
			intervalVolumes.set(strikePrice, strikeIntervalVolumes);
		});
		
		return intervalVolumes;
	}, [intervals]);
	
	const fetchData = useCallback(() => {
		if (fetchData.lock) return;
		fetchData.lock = true;
		
		fetch(`/api/option-chain?expiry=${encodeURIComponent(selectedExpiry)}`)
			.then(res => {
				if (!res.ok) throw new Error(res.statusText);
				return res.json();
			})
			.then(json => {
				setExpiryOptions(json.records.expiryDates);
				
				// Update NIFTY spot price and calculate ATM
				if (json.niftySpot) {
					setNiftySpot(json.niftySpot);
					const atm = calculateNiftyATM(json.niftySpot);
					setNiftyATM(atm);
					
					// Calculate ranges
					const newRanges = calculateRanges(atm);
					setRanges(newRanges);
				}
				
				const filtered = json.records.data.filter(
					d => d.expiryDates === selectedExpiry
				);
				
				// Calculate interval volumes
				const intervalVolumes = calculateIntervalVolumes(filtered, rows);
				
				const tableRows = filtered.map(d => {
					const ceVol = d.CE?.totalTradedVolume ?? 0;
					const peVol = d.PE?.totalTradedVolume ?? 0;
					let signal;
					if (ceVol === peVol) signal = 'Equal';
					else if (peVol === 0 && ceVol > 0) signal = 'Call';
					else if (ceVol === 0 && peVol > 0) signal = 'Put';
					else signal = ceVol / peVol > 1 ? 'Call' : 'Put';
					
					const intervalVols = intervalVolumes.get(d.strikePrice) || {};
					
					// Calculate signals for each interval
					const intervalSignals = {};
					intervals.forEach(minutes => {
						const ceIntervalVol = intervalVols[`ce${minutes}min`] || 0;
						const peIntervalVol = intervalVols[`pe${minutes}min`] || 0;
						
						let signal;
						if (ceIntervalVol === 0 && peIntervalVol === 0) {
							signal = '-'; // No activity
						} else if (ceIntervalVol === peIntervalVol) {
							signal = 'Equal';
						} else if (peIntervalVol === 0 && ceIntervalVol > 0) {
							signal = 'Call';
						} else if (ceIntervalVol === 0 && peIntervalVol > 0) {
							signal = 'Put';
						} else {
							signal = ceIntervalVol / peIntervalVol > 1 ? 'Call' : 'Put';
						}
						
						intervalSignals[`signal${minutes}min`] = signal;
					});
					
					return {
						strikePrice: d.strikePrice,
						ceVolume: ceVol,
						peVolume: peVol,
						...intervalVols,
						...intervalSignals,
					};
				});
				
				setRows(tableRows);
				setError(null);
				lastUpdateTime.current = Date.now();
			})
			.catch(() => setError('Failed to load data'))
			.finally(() => {
				setLoading(false);
				fetchData.lock = false;
			});
	}, [selectedExpiry, calculateIntervalVolumes, rows, intervals]);
	
	// Clear volume history when expiry changes
	useEffect(() => {
		volumeHistory.current.clear();
		lastUpdateTime.current = Date.now();
	}, [selectedExpiry]);
	
	useEffect(() => {
		fetchData.lock = false;
		fetchData();
		
		const id = setInterval(() => {
			const now = new Date();
			const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
			const hours = istNow.getHours();
			const minutes = istNow.getMinutes();
			
			const afterOpen = hours > 9 || (hours === 9 && minutes >= 15);
			const beforeClose = hours < 15 || (hours === 15 && minutes <= 29);
			
			if (afterOpen && beforeClose) {
				fetchData();
			}
		}, 10000); // Fetch every 10 seconds
		
		return () => clearInterval(id);
	}, [selectedExpiry]);
	
	if (loading) {
		return (
			<div className="loading-container">
				<div className="loading-spinner"></div>
				<p>Loading option chain data...</p>
			</div>
		);
	}
	
	if (error) {
		return (
			<div className="error-container">
				<div className="error-icon">⚠️</div>
				<p>{error}</p>
				<button onClick={() => window.location.reload()} className="retry-button">
					Retry
				</button>
			</div>
		);
	};
	
	// Add helper functions inside the component:
	const getStrikeLabel = (strikePrice) => {
		if (strikePrice === ranges.c_low) return 'C_Low';
		if (strikePrice === ranges.c_high) return 'C_High';
		if (strikePrice === ranges.p_low) return 'P_Low';
		if (strikePrice === ranges.p_high) return 'P_High';
		if (strikePrice === niftyATM) return 'ATM';
		return null;
	};
	
	const renderRowCells = (row, label) => (
		<>
			<td className="td-strike">
				{row.strikePrice}
				{label && <span className="strike-label">{label}</span>}
			</td>
			<td className="td-volume">{row.ceVolume.toLocaleString()}</td>
			{intervals.map(min => {
				const volume = row[`ce${min}min`] || 0;
				const signal = row[`signal${min}min`] || '-';
				return (
					<td
						key={`ce${min}`}
						className={`td-interval ${volume > 0 ? 'volume-positive-call' : ''}`}
					>
						{volume > 0 ? (
							<div className="interval-cell">
              <span className="volume-badge">
                {volume.toLocaleString()}
              </span>
								<span className={`signal-indicator signal-${signal.toLowerCase()}`}>
                {signal === 'Call' ? 'C' : signal === 'Put' ? 'P' : signal === 'Equal' ? '=' : ''}
              </span>
							</div>
						) : '-'}
					</td>
				);
			})}
			<td className="td-volume">{row.peVolume.toLocaleString()}</td>
			{intervals.map(min => {
				const volume = row[`pe${min}min`] || 0;
				const signal = row[`signal${min}min`] || '-';
				return (
					<td
						key={`pe${min}`}
						className={`td-interval ${volume > 0 ? 'volume-positive-put' : ''}`}
					>
						{volume > 0 ? (
							<div className="interval-cell">
              <span className="volume-badge">
                {volume.toLocaleString()}
              </span>
								<span className={`signal-indicator signal-${signal.toLowerCase()}`}>
                {signal === 'Call' ? 'C' : signal === 'Put' ? 'P' : signal === 'Equal' ? '=' : ''}
              </span>
							</div>
						) : '-'}
					</td>
				);
			})}
		</>
	);
	
	return (
		<div className="option-chain-wrapper">
			<div className="option-chain-container">
				<div className="header-section">
					<h1 className="main-title">NSE Option Chain</h1>
					{niftySpot && niftyATM && (
						<div className="market-info">
							<div className="spot-price">
								<span className="label">NIFTY Spot </span>
								<span className="value">{niftySpot.toFixed(2)}</span>
							</div>
							<div className="atm-value">
								<span className="label">NIFTY ATM </span>
								<span className="value">{niftyATM}</span>
							</div>
							{ranges.c_low && (
								<div className="ranges-info">
									<div className="call-ranges">
										<span className="label">Call Range</span>
										<div className="range-values">
											<span className="range-box c-low">{ranges.c_low}</span>
											<span className="range-separator">-</span>
											<span className="range-box c-high">{ranges.c_high}</span>
										</div>
									</div>
									<div className="put-ranges">
										<span className="label">Put Range</span>
										<div className="range-values">
											<span className="range-box p-low">{ranges.p_low}</span>
											<span className="range-separator">-</span>
											<span className="range-box p-high">{ranges.p_high}</span>
										</div>
									</div>
								</div>
							)}
						</div>
					)}
					
					{/* Add Legend in Header */}
					{ranges.c_low && (
						<div className="header-legend">
							<div className="legend-item">
								<div className="legend-bar atm"></div>
								<span>ATM: {niftyATM}</span>
							</div>
							<div className="legend-item">
								<div className="legend-bar c-low"></div>
								<span>C_Low: {ranges.c_low}</span>
							</div>
							<div className="legend-item">
								<div className="legend-bar c-high"></div>
								<span>C_High: {ranges.c_high}</span>
							</div>
							<div className="legend-item">
								<div className="legend-bar p-low"></div>
								<span>P_Low: {ranges.p_low}</span>
							</div>
							<div className="legend-item">
								<div className="legend-bar p-high"></div>
								<span>P_High: {ranges.p_high}</span>
							</div>
						</div>
					)}
					
					<div className="controls-section">
						<div className="expiry-selector">
							<label>Expiry Date</label>
							<select
								value={selectedExpiry}
								onChange={e => setSelectedExpiry(e.target.value)}
								className="expiry-dropdown"
							>
								{expiryOptions.map(exp => (
									<option key={exp} value={exp}>{exp}</option>
								))}
							</select>
						</div>
						<div className="update-info">
							<span className="update-label">Last Updated</span>
							<span className="update-time">
	              {new Date(lastUpdateTime.current).toLocaleTimeString('en-IN', {
		              timeZone: 'Asia/Kolkata',
		              hour: '2-digit',
		              minute: '2-digit',
		              second: '2-digit'
	              })}
	            </span>
						</div>
					</div>
				</div>
				
				<div className="table-wrapper">
					<table className="option-chain-table">
						<thead>
						<tr className="header-primary">
							<th rowSpan="3" className="th-strike">Strike Price</th>
							<th colSpan="8" className="th-call">
								<span className="header-icon">📈</span> Call Options
							</th>
							<th colSpan="8" className="th-put">
								<span className="header-icon">📉</span> Put Options
							</th>
						</tr>
						<tr className="header-secondary">
							<th rowSpan="2" className="th-volume">Total Volume</th>
							<th colSpan="7" className="th-interval">Interval Volume</th>
							<th rowSpan="2" className="th-volume">Total Volume</th>
							<th colSpan="7" className="th-interval">Interval Volume</th>
						</tr>
						<tr className="header-tertiary">
							{intervals.map(min => (
								<th key={`ce${min}`} className="th-interval-min">{min}m</th>
							))}
							{intervals.map(min => (
								<th key={`pe${min}`} className="th-interval-min">{min}m</th>
							))}
						</tr>
						</thead>
						<tbody>
						
						{/* Special Rows Section - Pinned at top */}
						{rows.length > 0 && ranges.c_low && (
							<>
								<tr className="section-separator">
									<td colSpan="17" className="section-title">Key Strike Levels</td>
								</tr>
								{/* ATM Row */}
								{rows.find(row => row.strikePrice === niftyATM) && (
									<tr className="highlight-atm special-row">
										{renderRowCells(rows.find(row => row.strikePrice === niftyATM), 'ATM')}
									</tr>
								)}
								{/* C_Low Row */}
								{rows.find(row => row.strikePrice === ranges.c_low) && (
									<tr className="highlight-c-low special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.c_low), 'C_Low')}
									</tr>
								)}
								{/* C_High Row */}
								{rows.find(row => row.strikePrice === ranges.c_high) && (
									<tr className="highlight-c-high special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.c_high), 'C_High')}
									</tr>
								)}
								{/* P_Low Row */}
								{rows.find(row => row.strikePrice === ranges.p_low) && (
									<tr className="highlight-p-low special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.p_low), 'P_Low')}
									</tr>
								)}
								{/* P_High Row */}
								{rows.find(row => row.strikePrice === ranges.p_high) && (
									<tr className="highlight-p-high special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.p_high), 'P_High')}
									</tr>
								)}
								<tr className="section-separator">
									<td colSpan="17" className="section-title">All Strike Prices</td>
								</tr>
							</>
						)}
						{rows.map((row, index) => (
							<tr
								key={row.strikePrice}
								className={`${index % 2 === 0 ? 'row-even' : 'row-odd'} ${getRowClass(row.strikePrice)}`}
							>
								{renderRowCells(row, getStrikeLabel(row.strikePrice))}
							</tr>
						))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
	
}

export default OptionChainTable;