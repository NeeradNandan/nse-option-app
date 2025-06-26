import React, { useState, useEffect, useCallback, useRef } from 'react';
import './index.css'; // We'll create this CSS file

function OptionChainTable({ expiry = '26-Jun-2025' }) {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [expiryOptions, setExpiryOptions] = useState([]);
	const [selectedExpiry, setSelectedExpiry] = useState(expiry);
	
	// Store historical volume data
	const volumeHistory = useRef(new Map());
	const lastUpdateTime = useRef(Date.now());
	
	// Time intervals in minutes
	const intervals = [1, 3, 6, 12, 18, 24, 30];
	
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
					
					return {
						strikePrice: d.strikePrice,
						ceVolume: ceVol,
						peVolume: peVol,
						signal,
						...intervalVols
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
	}, [selectedExpiry, calculateIntervalVolumes, rows]);
	
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
		}, 3000); // Fetch every 3 seconds
		
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
	}
	
	return (
		<div className="option-chain-container">
			<div className="header-section">
				<h1 className="main-title">NSE Option Chain</h1>
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
						<th rowSpan="3" className="th-signal">Signal</th>
						<th colSpan="8" className="th-call">Call Options</th>
						<th colSpan="8" className="th-put">Put Options</th>
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
					{rows.map((row, index) => (
						<tr key={row.strikePrice} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
							<td className="td-strike">{row.strikePrice}</td>
							<td className={`td-signal signal-${row.signal.toLowerCase()}`}>
								<span className="signal-badge">{row.signal}</span>
							</td>
							<td className="td-volume">{row.ceVolume.toLocaleString()}</td>
							{intervals.map(min => {
								const volume = row[`ce${min}min`] || 0;
								return (
									<td
										key={`ce${min}`}
										className={`td-interval ${volume > 0 ? 'volume-positive-call' : ''}`}
									>
										{volume > 0 && (
											<span className="volume-badge">
                          {volume.toLocaleString()}
                        </span>
										)}
										{volume === 0 && '-'}
									</td>
								);
							})}
							<td className="td-volume">{row.peVolume.toLocaleString()}</td>
							{intervals.map(min => {
								const volume = row[`pe${min}min`] || 0;
								return (
									<td
										key={`pe${min}`}
										className={`td-interval ${volume > 0 ? 'volume-positive-put' : ''}`}
									>
										{volume > 0 && (
											<span className="volume-badge">
                          {volume.toLocaleString()}
                        </span>
										)}
										{volume === 0 && '-'}
									</td>
								);
							})}
						</tr>
					))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default OptionChainTable;