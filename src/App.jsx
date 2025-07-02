import React, { useState, useEffect, useCallback, useRef } from 'react';
import './index.css'; // We'll create this CSS file

function OptionChainTable() {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const [expiryOptions, setExpiryOptions] = useState([]);
	const [selectedExpiry, setSelectedExpiry] = useState('');
	const [initializing, setInitializing] = useState(true);
	const [niftySpot, setNiftySpot] = useState(null);
	const [niftyATM, setNiftyATM] = useState(null);
	const [offsets, setOffsets] = useState({ large: 250, small: 150 });
	const [ranges, setRanges] = useState({
		                                     c_low: null,
		                                     c_high: null,
		                                     p_low: null,
		                                     p_high: null
	                                     });
	const [keyStrikeRatios, setKeyStrikeRatios] = useState({
		                                                       CPRL: 0,
		                                                       CPRH: 0,
		                                                       PCRL: 0,
		                                                       PCRH: 0
	                                                       });
	const [selectedRatioInterval, setSelectedRatioInterval] = useState('1');
	const [isAppActive, setIsAppActive] = useState(true);
	const intervalRef = useRef(null);
	const inactiveTimeoutRef = useRef(null);
	const [dataStats, setDataStats] = useState({ totalFetches: 0, totalDataKB: 0 });
	
	
	
	// Store historical volume data
	const volumeHistory = useRef(new Map());
	const lastUpdateTime = useRef(Date.now());
	
	// Time intervals in minutes
	const intervals = [1, 3, 6, 12, 18, 24, 30];
	
	useEffect(() => {
		const initializeExpiry = async () => {
			try {
				// Make a simple request to get expiry dates
				const res = await fetch('/api/get-expiry-dates');
				if (!res.ok) throw new Error('Failed to fetch expiry dates');
				
				const data = await res.json();
				const expiryDates = data.expiryDates;
				
				if (expiryDates && expiryDates.length > 0) {
					setExpiryOptions(expiryDates);
					setSelectedExpiry(expiryDates[0]); // Set first expiry as default
					setInitializing(false);
				} else {
					throw new Error('No expiry dates available');
				}
			} catch (err) {
				setError('Failed to initialize: ' + err.message);
				setInitializing(false);
			}
		};
		
		initializeExpiry();
	}, []); // Run only once on mount
	
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
		
		let c_low = atmValue - offsets.large,
			c_high = atmValue - offsets.small,
			p_low = atmValue + offsets.small,
			p_high = atmValue + offsets.large;
		if (atmValue % 100 > 30 && atmValue % 100 < 40 ) {
			c_high -= 50;
			p_high -= 50;
		} else if (atmValue % 100 > 60 && atmValue % 100 < 70 ) {
			c_low += 50;
			p_low += 50;
		}
		return {
			c_low ,
			c_high ,
			p_low,
			p_high
		};
	};
	
	
	useEffect(() => {
		if (niftyATM) {
			const newRanges = calculateRanges(niftyATM);
			setRanges(newRanges);
		}
	}, [niftyATM, offsets]);
	
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
	
	const calculateKeyStrikeSignals = useCallback((rows) => {
		if (!ranges.c_low || !rows.length) return { signals: {}, ratios: {} };
		
		// Find the relevant rows
		const cLowRow = rows.find(r => r.strikePrice === ranges.c_low);
		const cHighRow = rows.find(r => r.strikePrice === ranges.c_high);
		const pLowRow = rows.find(r => r.strikePrice === ranges.p_low);
		const pHighRow = rows.find(r => r.strikePrice === ranges.p_high);
		
		const keyStrikeSignals = {};
		const allRatios = {};
		
		intervals.forEach(minutes => {
			// Get volumes for THIS SPECIFIC INTERVAL
			const cLowCallVol = cLowRow?.[`ce${minutes}min`] || 0;
			const cLowPutVol = cLowRow?.[`pe${minutes}min`] || 0;
			
			const cHighCallVol = cHighRow?.[`ce${minutes}min`] || 0;
			const cHighPutVol = cHighRow?.[`pe${minutes}min`] || 0;
			
			const pLowCallVol = pLowRow?.[`ce${minutes}min`] || 0;
			const pLowPutVol = pLowRow?.[`pe${minutes}min`] || 0;
			
			const pHighCallVol = pHighRow?.[`ce${minutes}min`] || 0;
			const pHighPutVol = pHighRow?.[`pe${minutes}min`] || 0;
			
			// Calculate ratios for THIS INTERVAL
			// CPRL = Call Volume (C_low) / Put Volume (P_low)
			const CPRL = pLowPutVol > 0 ? cLowCallVol / pLowPutVol : 0;
			
			// CPRH = Call Volume (C_high) / Put Volume (P_high)
			const CPRH = pHighPutVol > 0 ? cHighCallVol / pHighPutVol : 0;
			
			// PCRL = Put Volume (P_low) / Call Volume (C_low)
			const PCRL = cLowCallVol > 0 ? pLowPutVol / cLowCallVol : 0;
			
			// PCRH = Put Volume (P_high) / Call Volume (C_high)
			const PCRH = cHighCallVol > 0 ? pHighPutVol / cHighCallVol : 0;
			
			// Store ratios for this interval
			allRatios[`${minutes}min`] = { CPRL, CPRH, PCRL, PCRH };
			
			// Determine signal based on special logic
			let signal = '-';
			
			if ((CPRL > 1 && CPRH > 1) || (CPRH > PCRL)) {
				signal = 'Call';
			} else if ((PCRL > 1 && PCRH > 1) || (PCRL > CPRH)) {
				signal = 'Put';
			} else if (CPRL === 0 && CPRH === 0 && PCRL === 0 && PCRH === 0) {
				signal = '-';
			} else {
				signal = 'Equal';
			}
			
			// Store signals for each key strike
			keyStrikeSignals[`${ranges.c_low}_${minutes}min`] = signal;
			keyStrikeSignals[`${ranges.c_high}_${minutes}min`] = signal;
			keyStrikeSignals[`${ranges.p_low}_${minutes}min`] = signal;
			keyStrikeSignals[`${ranges.p_high}_${minutes}min`] = signal;
		});
		
		return { signals: keyStrikeSignals, ratios: allRatios };
	}, [ranges, intervals]);
	
	
	const fetchData = useCallback( () => {
		
		if (fetchData.lock || !selectedExpiry) return;
		fetchData.lock = true;
		
		const startTime = performance.now();
		
		console.log('🔵 FETCH_DATA called at:', new Date().toLocaleTimeString(), 'Stack:', new Error().stack.split('\n')[2]);
		
		fetch(`/api/option-chain?expiry=${encodeURIComponent(selectedExpiry)}`)
			.then(res => {
				const endTime = performance.now();
				console.log('⏱ API Response time:', `${(endTime - startTime).toFixed(2)}ms`);
				
				if (!res.ok) throw new Error(res.statusText);
				return res.json();
			})
			.then(json => {
				const dataSizeKB = JSON.stringify(json).length / 1024;
				setDataStats(prev => ({
					totalFetches: prev.totalFetches + 1,
					totalDataKB: prev.totalDataKB + dataSizeKB
				}));
				
				console.log('📊 Data fetched:', {
					timestamp: new Date().toLocaleTimeString(),
					totalRecords: json.records?.data?.length || 0,
					filteredRecords: json.records?.data?.filter(d => d.expiryDates === selectedExpiry)?.length || 0,
					dataSizeKB: (JSON.stringify(json).length / 1024).toFixed(2),
					niftySpot: json.niftySpot,
					expiryDates: json.records?.expiryDates?.length || 0
				});
				
				if (json.records.expiryDates) {
					setExpiryOptions(json.records.expiryDates);
				}
				
				// Update NIFTY spot price and calculate ATM
				if (json.niftySpot) {
					setNiftySpot(json.niftySpot);
					/*setNiftySpot(25535);*/
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
					
					const intervalVols = intervalVolumes.get(d.strikePrice) || {};
					
					// Calculate signals for each interval
					const intervalSignals = {};
					intervals.forEach(minutes => {
						const ceIntervalVol = intervalVols[`ce${minutes}min`] || 0;
						const peIntervalVol = intervalVols[`pe${minutes}min`] || 0;
						
						let signal;
						if (ceIntervalVol === 0 && peIntervalVol === 0) {
							signal = '-';
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
						...intervalSignals
					};
				});
				
				// Calculate key strike signals
				const keyStrikeData = calculateKeyStrikeSignals(tableRows);
				const keyStrikeSignals = keyStrikeData.signals;
				const ratios = keyStrikeData.ratios;
				
				if (ratios) {
					setKeyStrikeRatios(ratios);
				}
				
				// Apply key strike signals to relevant rows
				const finalRows = tableRows.map(row => {
					const isKeyStrike = [ranges.c_low, ranges.c_high, ranges.p_low, ranges.p_high, niftyATM].includes(row.strikePrice);
					
					if (isKeyStrike) {
						// Override signals with key strike signals
						const updatedSignals = {};
						intervals.forEach(minutes => {
							updatedSignals[`signal${minutes}min`] = keyStrikeSignals[`${row.strikePrice}_${minutes}min`] || '-';
						});
						
						return {
							...row,
							...updatedSignals,
							isKeyStrike: true
						};
					}
					
					return row;
				});
				
				setRows(finalRows);
				
				console.log('📈 Volume History Stats:', {
					totalStrikes: volumeHistory.current.size,
					historyDataPoints: Array.from(volumeHistory.current.values()).reduce((sum, history) => sum + history.timestamps.length, 0),
					memoryUsageKB: (JSON.stringify(Object.fromEntries(volumeHistory.current)).length / 1024).toFixed(2)
				});
				setError(null);
				lastUpdateTime.current = Date.now();
			})
			.catch(() => setError('Failed to load data'))
			.finally(() => {
				setLoading(false);
				fetchData.lock = false;
			});
	}, [selectedExpiry, calculateIntervalVolumes, calculateKeyStrikeSignals, intervals, ranges, niftyATM, keyStrikeRatios]);
	
	// Clear volume history when expiry changes
	useEffect(() => {
		volumeHistory.current.clear();
		lastUpdateTime.current = Date.now();
	}, [selectedExpiry]);
	
	const startInterval = useCallback(() => {
		console.log('🟡 START_INTERVAL called at:', new Date().toLocaleTimeString());
		if (intervalRef.current) {
			console.log('🔴 CLEARING existing interval:', intervalRef.current);
			clearInterval(intervalRef.current);
		}
		
		intervalRef.current = setInterval(() => {
			console.log('⏰ INTERVAL TICK at:', new Date().toLocaleTimeString());
			if (!isAppActive) return; // Don't fetch if app is not active
			
			const now = new Date();
			const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
			const hours = istNow.getHours();
			const minutes = istNow.getMinutes();
			const dayOfWeek = istNow.getDay();
			
			const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
			const afterOpen = hours > 9 || (hours === 9 && minutes >= 15);
			const beforeClose = hours < 15 || (hours === 15 && minutes <= 29);
			
			if (isWeekday && afterOpen && beforeClose) {
				console.log('📞 CALLING fetchData from main effect');
				fetchData();
			}
		}, 8000);
		console.log('🟢 NEW INTERVAL created:', intervalRef.current);
	}, [isAppActive, fetchData]);
	
	useEffect( () => {
		console.log(`Data fetch is triggered once`);
		if (!initializing || selectedExpiry) fetchData();
	}, [selectedExpiry, initializing] );
	
	useEffect(() => {
		console.log('🔶 MAIN_EFFECT triggered - selectedExpiry:', selectedExpiry, 'initializing:', initializing);
		if (initializing || !selectedExpiry) return;
		
		//fetchData.lock = true;
		//console.log('📞 CALLING fetchData from main effect');
		
		
		startInterval();
		//fetchData.lock = false;
		//console.log(`C_HIGH: ${ranges.c_high}`);
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (inactiveTimeoutRef.current) {
				clearTimeout(inactiveTimeoutRef.current);
				inactiveTimeoutRef.current = null;
			}
		};
	}, [selectedExpiry, initializing, startInterval]);
	
	// Handle browser visibility and focus changes
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				// User switched away from tab/minimized browser
				setIsAppActive(false);
				// Set a timeout to stop requests after 1 minute of inactivity
				inactiveTimeoutRef.current = setTimeout(() => {
					if (intervalRef.current) {
						clearInterval(intervalRef.current);
						intervalRef.current = null;
					}
				}, 60000); // 1 minute
			} else {
				// User returned to tab
				setIsAppActive(true);
				// Clear the inactive timeout
				if (inactiveTimeoutRef.current) {
					clearTimeout(inactiveTimeoutRef.current);
					inactiveTimeoutRef.current = null;
				}
				// Restart interval if it was stopped
				if (!intervalRef.current && !initializing && selectedExpiry) {
					startInterval();
				}
			}
		};
		
		const handleFocus = () => {
			setIsAppActive(true);
			if (inactiveTimeoutRef.current) {
				clearTimeout(inactiveTimeoutRef.current);
				inactiveTimeoutRef.current = null;
			}
		};
		
		const handleBlur = () => {
			setIsAppActive(false);
			inactiveTimeoutRef.current = setTimeout(() => {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			}, 60000);
		};
		
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('blur', handleBlur);
		
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
			window.removeEventListener('blur', handleBlur);
			if (inactiveTimeoutRef.current) {
				clearTimeout(inactiveTimeoutRef.current);
			}
		};
	}, [initializing, selectedExpiry, startInterval]);
	
	
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
	
	const formatDataSize = (sizeInKB) => {
		if (sizeInKB < 1024) {
			return `${sizeInKB.toFixed(1)} KB`;
		} else if (sizeInKB < 1024 * 1024) {
			return `${(sizeInKB / 1024).toFixed(1)} MB`;
		} else {
			return `${(sizeInKB / (1024 * 1024)).toFixed(1)} GB`;
		}
	};
	const getStrikeLabel = (strikePrice) => {
		if (strikePrice === ranges.c_low) return 'C_Low';
		if (strikePrice === ranges.c_high) return 'C_High';
		if (strikePrice === ranges.p_low) return 'P_Low';
		if (strikePrice === ranges.p_high) return 'P_High';
		if (strikePrice === niftyATM) return 'ATM';
		return null;
	};
	
	// Update renderRowCells to show special indicator for key strike signals
	const renderRowCells = (row, label) => {
		const isATM = row.strikePrice === niftyATM;
		
		return (
			<>
				<td className="td-strike">
					{row.strikePrice}
					{label && <span className="strike-label">{label}</span>}
					{row.isKeyStrike && <span className="key-strike-indicator">★</span>}
				</td>
				<td className="td-volume">{row.ceVolume.toLocaleString()}</td>
				{intervals.map(min => {
					const volume = row[`ce${min}min`] || 0;
					const signal = row[`signal${min}min`] || '-';
					
					return (
						<td
							key={`ce${min}`}
							className={`td-interval ${volume > 0 ? 'volume-positive-call' : ''} ${row.isKeyStrike ? 'key-strike-cell' : ''}`}
						>
							{volume > 0 ? (
								<div className="interval-cell">
                <span className="volume-badge">
                  {volume.toLocaleString()}
                </span>
									{!isATM && (  // Don't show signal for ATM
										<span className={`signal-indicator signal-${signal.toLowerCase()} ${row.isKeyStrike ? 'key-signal' : ''}`}>
                    {signal === 'Call' ? 'C' : signal === 'Put' ? 'P' : signal === 'Equal' ? '=' : ''}
                  </span>
									)}
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
							className={`td-interval ${volume > 0 ? 'volume-positive-put' : ''} ${row.isKeyStrike ? 'key-strike-cell' : ''}`}
						>
							{volume > 0 ? (
								<div className="interval-cell">
                <span className="volume-badge">
                  {volume.toLocaleString()}
                </span>
									{!isATM && (  // Don't show signal for ATM
										<span className={`signal-indicator signal-${signal.toLowerCase()} ${row.isKeyStrike ? 'key-signal' : ''}`}>
                    {signal === 'Call' ? 'C' : signal === 'Put' ? 'P' : signal === 'Equal' ? '=' : ''}
                  </span>
									)}
								</div>
							) : '-'}
						</td>
					);
				})}
			</>
		);
	};
	
	//console.log(keyStrikeRatios);
	
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
											<span className="range-box p-low">{ranges.c_high}</span>
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
					
					{/* Add ratios display */}
					{keyStrikeRatios && (
						<div className="ratios-section">
							<div className="ratios-header">
								<span className="ratios-title">Key Strike Ratios</span>
								<select
									className="interval-selector"
									value={selectedRatioInterval}
									onChange={(e) => setSelectedRatioInterval(e.target.value)}
								>
									{intervals.map(min => (
										<option key={min} value={min}>{min}min</option>
									))}
								</select>
							</div>
							<div className="ratios-display">
								<div className="ratio-item">
									<span className="ratio-label">CPRL</span>
									<span className="ratio-value">
          {keyStrikeRatios[`${selectedRatioInterval}min`]?.CPRL?.toFixed(3) || '0.000'}
        </span>
								</div>
								<div className="ratio-item">
									<span className="ratio-label">CPRH</span>
									<span className="ratio-value">
          {keyStrikeRatios[`${selectedRatioInterval}min`]?.CPRH?.toFixed(3) || '0.000'}
        </span>
								</div>
								<div className="ratio-item">
									<span className="ratio-label">PCRL</span>
									<span className="ratio-value">
          {keyStrikeRatios[`${selectedRatioInterval}min`]?.PCRL?.toFixed(3) || '0.000'}
        </span>
								</div>
								<div className="ratio-item">
									<span className="ratio-label">PCRH</span>
									<span className="ratio-value">
          {keyStrikeRatios[`${selectedRatioInterval}min`]?.PCRH?.toFixed(3) || '0.000'}
        </span>
								</div>
							</div>
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
						<div className="offsets-selector">
							<label>C_Low/P_High Offset:</label>
							<input
								type="number"
								value={offsets.large}
								onChange={(e) => {
									const value = e.target.value;
									if (!isNaN(value) && value !== '') {
										setOffsets((prev) => ({ ...prev, large: Number(value) }));
									}
								}}
							/>
							<label>C_High/P_Low Offset:</label>
							<input
								type="number"
								value={offsets.small}
								onChange={(e) => {
									const value = e.target.value;
									if (!isNaN(value) && value !== '') {
										setOffsets((prev) => ({ ...prev, small: Number(value) }));
									}
								}}
							/>
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
						{/* Add this new data stats section */}
						<div className="data-stats">
							<div className="stat-item">
								<span className="stat-label">Total Fetches </span>
								<span className="stat-value">{dataStats.totalFetches}</span>
							</div>
							<div className="stat-item">
								<span className="stat-label">Data Used </span>
								<span className="stat-value">{formatDataSize(dataStats.totalDataKB)}</span>
							</div>
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
								{/* P_Low Row */}
								{rows.find(row => row.strikePrice === ranges.p_low) && (
									<tr className="highlight-p-low special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.p_low), 'P_Low')}
									</tr>
								)}
								{/* C_High Row */}
								{rows.find(row => row.strikePrice === ranges.c_high) && (
									<tr className="highlight-c-high special-row">
										{renderRowCells(rows.find(row => row.strikePrice === ranges.c_high), 'C_High')}
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