# ICP Token Frontend

A beautiful, modern web interface for managing your ICP fungible token.

## Features

- 🔐 **Internet Identity Authentication** - Secure login with II
- 💰 **Token Management** - View balances, transfer tokens, mint new tokens
- 🛡️ **Approval System** - Approve other principals to spend your tokens
- 📱 **Responsive Design** - Works on desktop and mobile
- 🎨 **Modern UI** - Clean, intuitive interface with Tailwind CSS

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- DFX (for local development)

### Installation

1. **Install Dependencies**
   ```bash
   cd src/frontend
   npm install
   ```

2. **Start Local Development**
   ```bash
   # Make sure dfx is running
   dfx start --background
   
   # Deploy the token canister
   dfx deploy token
   
   # Start the frontend development server
   npm start
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

## Usage

### Connecting Your Wallet

1. Click "Connect Wallet" button
2. Choose your Internet Identity provider
3. Authenticate with your II
4. You're now connected and can manage your tokens!

### Managing Tokens

- **View Balance**: Your current token balance is displayed in the Token Information card
- **Transfer Tokens**: Enter a principal ID and amount to send tokens
- **Mint Tokens**: Create new tokens (if you have minting permissions)
- **Approve Spending**: Allow other principals to spend your tokens

### Features

#### Token Information
- Token name, symbol, and decimals
- Total supply
- Your current balance
- Real-time updates

#### Transfer Functionality
- Send tokens to any principal
- Input validation
- Transaction status feedback

#### Minting
- Create new tokens
- Automatic balance updates
- Error handling

#### Approvals
- Approve other principals to spend your tokens
- Set spending limits
- Manage allowances

## Development

### Project Structure

```
src/frontend/
├── public/
│   └── index.html          # Main HTML file
├── src/
│   ├── App.js              # Main React component
│   ├── icp.js              # ICP integration service
│   ├── index.js            # React entry point
│   └── index.css           # Tailwind CSS styles
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind configuration
└── postcss.config.js       # PostCSS configuration
```

### Key Components

#### `App.js`
- Main application component
- Handles authentication state
- Manages token operations
- UI layout and interactions

#### `icp.js`
- ICP integration service
- Internet Identity authentication
- Token canister interactions
- Error handling

### Styling

The frontend uses **Tailwind CSS** for styling with:
- Responsive design
- Modern UI components
- Consistent color scheme
- Smooth animations

### Customization

#### Colors
Edit `tailwind.config.js` to customize the color scheme:
```javascript
colors: {
  primary: {
    50: '#eff6ff',
    500: '#3b82f6',  // Main brand color
    600: '#2563eb',
    700: '#1d4ed8',
  }
}
```

#### Token Configuration
Update the canister ID in `src/icp.js`:
```javascript
const TOKEN_CANISTER_ID = 'your-canister-id';
```

## Deployment

### Local Deployment
```bash
dfx deploy
```

### Mainnet Deployment
```bash
dfx deploy --network ic
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Make sure Internet Identity is running locally
   - Check browser console for errors
   - Verify canister ID is correct

2. **Build Errors**
   - Run `npm install` to install dependencies
   - Check Node.js version (v16+ required)
   - Clear npm cache: `npm cache clean --force`

3. **Token Operations Failing**
   - Verify canister is deployed and running
   - Check principal ID format
   - Ensure sufficient balance for transfers

### Getting Help

- Check the browser console for error messages
- Verify canister deployment with `dfx canister status`
- Test canister functions directly with `dfx canister call`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is provided as-is for educational and development purposes. 