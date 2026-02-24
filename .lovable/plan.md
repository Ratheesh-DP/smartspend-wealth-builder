

# SmartSpend AI — Intelligent Personal Finance & Investment Platform

## Design & Theme
- **Dark fintech theme** with neon green/cyan accents on a deep dark background (inspired by Zerodha/Robinhood)
- Indian market focused: ₹ currency, Indian investment instruments (Mutual Funds, FDs, Gold, PPF)
- Responsive design optimized for both desktop and mobile

---

## Phase 1: Foundation & Auth

### User Authentication
- Sign up / Login with email and password via Supabase Auth
- Google sign-in option
- User profiles table storing name, avatar, and preferences

### App Layout
- Sidebar navigation with collapsible menu (Dashboard, Transactions, Budget, Insights, Investments, Settings)
- Top bar with user avatar, notifications bell, and quick-add transaction button

---

## Phase 2: Expense Tracking & Dashboard

### Dashboard
- Monthly overview cards: Total Income, Total Expenses, Savings, Budget remaining
- Spending breakdown donut chart by category
- Recent transactions list
- Month-over-month trend line chart

### Transaction Management
- Add/edit/delete transactions (amount, category, date, notes)
- Auto-categorization with smart rules (Food, Travel, Shopping, Bills, Entertainment, etc.)
- Bank statement CSV upload with drag-and-drop for bulk import
- Search, filter by category/date range, and sort transactions

### Budget Management
- Set monthly budgets per category
- Visual progress bars showing budget utilization
- Budget vs actual comparison view

---

## Phase 3: Smart Insights Engine

### AI-Powered Alerts & Tips
- Rule-based insight cards with severity levels:
  - 💡 **Tips**: "You saved ₹2,400 more than last month!"
  - ⚠️ **Warnings**: "Food spending is up 18% this month"
  - 🚨 **Critical**: "You've used 92% of your monthly budget"
- Spending trend analysis (week-over-week, month-over-month)

### Spending Personality
- Classify users as Saver, Balanced Spender, or Comfort Spender based on patterns
- Personalized recommendations based on personality type

---

## Phase 4: Investment Advisor

### Risk Profiling
- Interactive questionnaire to assess risk appetite (Conservative, Moderate, Aggressive)
- Score-based assessment with visual risk meter

### Portfolio Recommendations
- Tailored asset allocation suggestions: Equity, Debt, Gold, FD, PPF
- Pie chart visualization of recommended vs current portfolio
- India-specific instruments: Mutual Funds, NPS, ELSS for tax saving

### Goal Tracking
- Set financial goals (Emergency Fund, Retirement, Home, Travel)
- Track progress with timeline and required monthly SIP calculations

---

## Phase 5: Premium & Pricing

### Freemium Model
- **Free tier**: Expense tracking, monthly budget, basic analytics
- **Premium (₹199/mo)**: Smart Insights, Investment Advisor, Trend Analysis, CSV upload
- Upgrade prompts with feature previews for free users
- Stripe integration for subscription payments

---

## Database Structure (Supabase)
- **profiles**: User profile data and preferences
- **transactions**: All income/expense records with categories
- **budgets**: Monthly category budgets
- **goals**: Financial goals with target amounts and timelines
- **risk_profiles**: Investment risk assessment results
- Row-level security on all tables so users only see their own data

