// src/OptionChainTable.jsx
import React, { useState, useEffect, useCallback } from 'react';

function OptionChainTable({ expiry = '26-Jun-2025' }) {
	const [rows, setRows]                   = useState([]);
	const [error, setError]                 = useState(null);
	const [loading, setLoading]             = useState(true);
	const [expiryOptions, setExpiryOptions] = useState([]);
	const [selectedExpiry, setSelectedExpiry] = useState(expiry);
	
	const fetchData = useCallback(() => {
		setLoading(true);
		fetch('/api/option-chain')
			.then(res => {
				if (!res.ok) throw new Error(res.statusText);
				return res.json();
			})
			.then(json => {
				setExpiryOptions(json.records.expiryDates);
				
				const filtered = json.records.data.filter(
					d => d.expiryDates === selectedExpiry
				);
				const tableRows = filtered.map(d => {
					const ceVol = d.CE?.totalTradedVolume ?? 0;
					const peVol = d.PE?.totalTradedVolume ?? 0;
					let signal;
					if (ceVol === peVol)               signal = 'Equal';
					else if (peVol === 0 && ceVol > 0) signal = 'Call';
					else if (ceVol === 0 && peVol > 0) signal = 'Put';
					else                               signal = ceVol / peVol > 1 ? 'Call' : 'Put';
					return { strikePrice: d.strikePrice, ceVolume: ceVol, peVolume: peVol, signal };
				});
				setRows(tableRows);
				setError(null);
			})
			.catch(() => setError('Failed to load data'))
			.finally(() => setLoading(false));
	}, [selectedExpiry]);
	
	// 1) On mount: initial load + start 10s polling
	useEffect(() => {
		fetchData();
		const id = setInterval(fetchData, 10_000);
		return () => clearInterval(id);
	}, []);
	
	// 2) Whenever selectedExpiry changes: immediately refetch
	useEffect(() => {
		fetchData();
	}, [selectedExpiry]);
	
	if (error)   return <div style={{ color: 'red' }}>Error: {error}</div>;
	
	return (
		<>
			<label>
				Expiry:&nbsp;
				<select
					value={selectedExpiry}
					onChange={e => setSelectedExpiry(e.target.value)}
				>
					{expiryOptions.map(exp => (
						<option key={exp} value={exp}>{exp}</option>
					))}
				</select>
			</label>
			<br /><br />
			<table style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
				<tr>
					<th style={th}>Strike</th>
					<th style={th}>CE Volume</th>
					<th style={th}>PE Volume</th>
					<th style={th}>Signal</th>
				</tr>
				</thead>
				<tbody>
				{rows.map(({ strikePrice, ceVolume, peVolume, signal }) => (
					<tr key={strikePrice}>
						<td style={td}>{strikePrice}</td>
						<td style={td}>{ceVolume.toLocaleString()}</td>
						<td style={td}>{peVolume.toLocaleString()}</td>
						<td style={td}>{signal}</td>
					</tr>
				))}
				</tbody>
			</table>
		</>
	);
}

const th = {
	border: '1px solid #ccc',
	padding: '0.5em',
	background: '#f5f5f5',
	textAlign: 'center',
	verticalAlign: 'middle'
};
const td = {
	border: '1px solid #ccc',
	padding: '0.5em',
	textAlign: 'center',
	verticalAlign: 'middle'
};

export default OptionChainTable;
