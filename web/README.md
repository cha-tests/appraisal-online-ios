# Appraisal Online - Web Version

A Next.js web application for the Appraisal Online marketplace.

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will open at **http://localhost:3000**

### 3. View Screens

- Home page shows options for Consumer or Broker
- Select your user type to see all relevant screens
- Click any screen to view it

## Project Structure

```
web/
├── app/
│   ├── page.tsx              # Home/Screen selector
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── consumer/             # Consumer screens
│   ├── broker/               # Broker screens
│   └── public/               # Public pages
├── package.json              # Dependencies
├── tailwind.config.js        # Tailwind configuration
├── next.config.js            # Next.js configuration
└── tsconfig.json             # TypeScript configuration
```

## Available Screens

### Consumer Flow
1. Home - Hero carousel and how it works
2. Address Entry - Google Places autocomplete
3. Property Details - 3-step form (bedrooms, sq ft, property type)
4. Loading - Animated loading with API calls
5. Report View - AI valuation with comparables
6. Broker Opt-ins - Connect with professionals
7. Confirmation - Success page

### Broker Onboarding
8. Splash - Hero and value prop
9. Onboarding - 4-step questionnaire
10. Value Reveal - Estimated leads calculation
11. Rating Prompt - 5-star rating
12. Paywall - Subscription details
13. Checkout - Payment form
14. Welcome - Confirmation

### Broker Dashboard
15. Dashboard - Welcome and metrics
16. Lead Inbox - All leads list
17. Lead Detail - Individual lead view
18. Profile - Broker profile editor

### Public Pages
19. Demo - Marketing showcase
20. Founders - Founder capacity counter
21. Business Model - How we make money

## Building for Production

```bash
npm run build
npm start
```

## Technologies

- **Next.js 14** - React framework
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Notes

- This web version uses Tailwind CSS instead of React Native StyleSheet
- All screen components are built from scratch for web
- The mobile version (React Native/Expo) is in the `mobile/` folder
- Both versions share the same business logic and data models
