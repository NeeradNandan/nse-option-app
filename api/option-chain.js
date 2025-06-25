// /api/option-chain.js
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';

const client = wrapper(axios.create({
	                                    jar: new tough.CookieJar(),
	                                    withCredentials: true,
                                    }));

const PAGE_HEADERS = {
	'Host': 'www.nseindia.com',
	'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
	'Accept-Language': 'en-US,en;q=0.9',
	'DNT': '1',
	'Referer': 'https://www.nseindia.com/option-chain',
	'Sec-Fetch-Site': 'same-origin',
	'Sec-Fetch-Mode': 'navigate',
	'Sec-Fetch-User': '?1',
	'Sec-Fetch-Dest': 'document',
	'Upgrade-Insecure-Requests': '1',
	'Cache-Control': 'no-cache',
	'Pragma': 'no-cache',
};

const API_HEADERS = {
	'Host': 'www.nseindia.com',
	'User-Agent': PAGE_HEADERS['User-Agent'],
	'Accept': '*/*',
	'Accept-Language': PAGE_HEADERS['Accept-Language'],
	'Sec-Ch-Ua': `"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"`,
	'Sec-Ch-Ua-Mobile': '?1',
	'Sec-Ch-Ua-Platform': '"Android"',
	'Sec-Fetch-Site': 'same-origin',
	'Sec-Fetch-Mode': 'cors',
	'Sec-Fetch-Dest': 'empty',
	'Referer': PAGE_HEADERS['Referer'],
};

export default async function handler(req, res) {
	const expiry = req.query.expiry || '26-Jun-2025';
	
	try {
		await client.get('https://www.nseindia.com/option-chain', {
			headers: PAGE_HEADERS
		});
		
		const apiUrl = 'https://www.nseindia.com/api/option-chain-v3';
		const { data } = await client.get(apiUrl, {
			headers: API_HEADERS,
			params: {
				type: 'Indices',
				symbol: 'NIFTY',
				expiry,
			}
		});
		
		if (typeof data !== 'object') {
			return res.status(502).json({ error: 'Unexpected response from NSE' });
		}
		
		res.status(200).json(data);
	} catch (err) {
		console.error('API Error:', err.message || err);
		res.status(502).json({ error: 'Failed to fetch NSE option-chain data' });
	}
}
