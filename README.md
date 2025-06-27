# 📈 NSE Option App

[![React](https://img.shields.io/badge/React-18.0+-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> A modern, responsive web application for analyzing NSE (National Stock Exchange) option chain data with real-time insights and comprehensive market analysis tools.

## ✨ Features

### 🎯 Core Functionality
- **Real-time Option Chain Data** - Live NSE option chain updates
- **Interactive Data Tables** - Specifically for options chains data you can set your offset
- **Strike Price Analysis** - Comprehensive strike price insights

### 📊 Advanced Analytics
- **Put-Call Ratio (PCR)** - Real-time PCR calculations
- **Volume Analysis** - Track trading volumes across strikes and for every intervals

### 🎨 User Experience
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Real-time Updates** - Auto-refresh with exhaustive intervals

## 🚀 Quick Start

### Prerequisites
- Node.js (v16.0 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NeeradNandan/nse-option-app.git
   cd nse-option-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev 
   #or
   vercel dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` or `http://localhost:3000` to view the application

### Production Build

```bash
npm run build
npm run preview
```

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **Vite** - Lightning-fast build tool and dev server
- **JavaScript (ES6+)** - Modern JavaScript features
- **CSS3** - Responsive styling with Flexbox/Grid

### Development Tools
- **ESLint** - Code linting and formatting
- **Hot Module Replacement (HMR)** - Instant updates during development
- **Vite Plugins** - Enhanced development experience

### APIs & Data Sources
- **REST API Integration** - Historical and live data fetching

## 🎯 Usage

### Basic Navigation
1. **Choose Expiry** - Select the expiry date for option contracts
2. **Analyze Data** - View comprehensive option chain data with real-time updates

### Advanced Features
- **Filter by Strike Range** - Focus on specific strike prices
- **Compare Timeframes** - Analyze data across different time periods

## 📖 API Documentation

### Endpoints Used
- `GET /api/option-chain/{symbol}` - Fetch option chain data

### Data Format
```json
{
  "symbol": "NIFTY",
  "expiry": "2024-01-25",
  "data": [
    {
      "strikePrice": 21000,
      "call": {
        "premium": 150.50,
        "volume": 1000,
        "openInterest": 50000
      },
      "put": {
        "premium": 75.25,
        "volume": 800,
        "openInterest": 45000
      }
    }
  ]
}
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📋 Roadmap

### Upcoming Features
- [ ] **Portfolio Tracking** - Track your option positions
- [ ] **Strategy Builder** - Create and test option strategies
- [ ] **Advanced Charts** - Technical analysis tools
- [ ] **Mobile App** - Native iOS/Android applications
- [ ] **Alerts System** - Price and volume-based notifications
- [ ] **Paper Trading** - Virtual trading environment

## ⚠️ Disclaimer

This application is for educational and informational purposes only. It is not intended as financial advice. Please consult with a qualified financial advisor before making investment decisions. The developers are not responsible for any financial losses incurred through the use of this application.

**Important Notes:**
- Market data may be delayed
- Always verify data from official sources
- Past performance does not guarantee future results
- Options trading involves significant risk

## 📞 Support

### Get Help
- **Issues**: [GitHub Issues](https://github.com/NeeradNandan/nse-option-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/NeeradNandan/nse-option-app/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Neerad Nandan**
- GitHub: [@NeeradNandan](https://github.com/NeeradNandan)

<div>

**⭐ Star this repo if you find it helpful!**

Made with ❤️ for the trading community

</div>