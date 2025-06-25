// server.mjs
import express from 'express';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';

const app = express();
app.use(express.json());

// create an axios instance with cookie jar support
const client = wrapper(axios.create({
	                                    jar: new tough.CookieJar(),
	                                    withCredentials: true,
                                    }));

// “browser” headers for loading the page
const PAGE_HEADERS = {
	'Host': 'www.nseindia.com',
	'User-Agent':
		'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) ' +
		'AppleWebKit/537.36 (KHTML, like Gecko) ' +
		'Chrome/137.0.0.0 Mobile Safari/537.36',
	'Accept':
		'text/html,application/xhtml+xml,application/xml;q=0.9,' +
		'image/avif,image/webp,image/apng,*/*;q=0.8',
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

// “browser” headers for the JSON fetch
const API_HEADERS = {
	'Host': 'www.nseindia.com',
	'User-Agent': PAGE_HEADERS['User-Agent'],
	'Accept': '*/*',
	'Accept-Language': PAGE_HEADERS['Accept-Language'],
	// we mimic exactly what you saw:
	'Sec-Ch-Ua': `"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"`,
	'Sec-Ch-Ua-Mobile': '?1',
	'Sec-Ch-Ua-Platform': '"Android"',
	'Sec-Fetch-Site': 'same-origin',
	'Sec-Fetch-Mode': 'cors',
	'Sec-Fetch-Dest': 'empty',
	'Referer': PAGE_HEADERS['Referer'],
};

app.get('/api/option-chain', async (req, res) => {
	try {
		// 1) Hit the option-chain _page_ first to get all cookies
		await client.get(
			'https://www.nseindia.com/option-chain',
			{ headers: PAGE_HEADERS }
		);
		
		// 2) Now fetch the v3 JSON endpoint
		//    Note the query params exactly as your browser did:
		const apiUrl = 'https://www.nseindia.com/api/option-chain-v3';
		const params = {
			type:   'Indices',
			symbol: 'NIFTY',
			expiry: '26-Jun-2025',
		};
		
		const { data } = await client.get(apiUrl, {
			headers: API_HEADERS,
			params,
			// axios will URL-encode expiry correctly to: expiry=26-Jun-2025
		});
		
		// 3) Sanity check
		if (typeof data !== 'object') {
			console.error('Expected JSON, got:', String(data).slice(0, 200));
			return res
				.status(502)
				.json({ error: 'NSE returned non-JSON; check logs.' });
		}
		
		// 4) Forward it
		res.json(data);
	} catch (err) {
		// dump whatever HTML or error we got
		if (err.response?.data) {
			console.error(
				'Fetch failed – first 300 chars of response:',
				String(err.response.data).slice(0, 300)
			);
		} else {
			console.error('Fetch error:', err.message);
		}
		res.status(502).json({ error: 'Failed to fetch NSE option-chain JSON' });
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
