# AI Factchecker

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An AI-powered fact-checking application that leverages Claude's advanced language understanding to analyze content and verify claims in real-time. Whether you're checking news articles, social media posts, or images, this tool helps combat misinformation by providing accurate, source-backed analysis.

## Features

- Multi-input support (text, URLs, and images)
- Reliability scoring (1-10 scale)
- Detailed analysis of claims
- False claim detection and correction
- Source verification with links
- Modern, responsive UI with animations
- Real-time analysis using Claude

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

## Prerequisites

- Node.js 18+ installed
- Anthropic API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file in the root directory and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technology Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Framer Motion
- Anthropic Claude API
- Cheerio for web scraping
- Axios for HTTP requests

## Usage

1. Choose your input type (text, URL, or image)
2. Enter or upload your content
3. Click "Check Facts"
4. View the detailed analysis, including:
   - Reliability score
   - Factual assessment
   - Detailed analysis
   - False claims and corrections
   - Verified sources

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for any purpose.

## Note

This project requires an Anthropic API key to function. Make sure to replace `your_api_key_here` in the `.env.local` file with your actual Anthropic API key.

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure your Anthropic API key is correctly set in `.env.local`
   - Verify the API key has sufficient credits
   - Check if the API key has the necessary permissions

2. **Build Errors**
   - Clear the `.next` folder and node_modules: `rm -rf .next node_modules`
   - Reinstall dependencies: `npm install`
   - Ensure you're using Node.js 18+: `node --version`

3. **Runtime Errors**
   - Check the browser console for client-side errors
   - Check the terminal output for server-side errors
   - Verify all environment variables are properly set

### Still Having Issues?
Open an issue on GitHub with:
- Your environment details (Node.js version, OS)
- Steps to reproduce the problem
- Error messages and logs
