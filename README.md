# Soccer League Schedule Generator

A beautiful, easy-to-use web application for generating round-robin tournament schedules for soccer leagues (or any sport!).

## Features

- **Double Round-Robin**: Each team plays every other team twice (home and away)
- **Flexible Scheduling**: Choose your game day, start date, and blackout dates
- **Automatic BYE Weeks**: Handles odd numbers of teams automatically
- **Export Options**: Download as Excel or CSV
- **No Installation Required**: Just open in a browser
- **Mobile Friendly**: Works on phones, tablets, and computers

## How to Use

### Option 1: Open Locally

1. Download the `index.html` file
2. Double-click to open it in your web browser
3. Fill in the form:
   - **Team Names**: Enter one team per line
   - **Start Date**: When should the season begin?
   - **Game Day**: What day of the week are games played?
   - **Blackout Dates** (optional): Dates to skip for holidays, etc.
4. Click "Generate Schedule"
5. Download as Excel or CSV

### Option 2: Host on GitHub Pages (Free!)

1. Push this repository to GitHub
2. Go to Settings > Pages
3. Select your branch and save
4. Your schedule generator will be live at: `https://yourusername.github.io/soccer-league/`
5. Share the link with anyone who needs to create schedules!

## How It Works

The application uses the **round-robin rotation algorithm** to ensure:
- Every team plays every other team exactly twice
- One game is at home, one is away
- No team plays themselves
- BYE weeks are automatically added for odd-numbered teams

### Example

**Input:**
- Teams: Team A, Team B, Team C, Team D
- Start Date: 2025-08-10
- Game Day: Sunday
- Blackout Dates: 2025-09-07 (holiday)

**Output:**
| Week | Date | Home Team | Away Team |
|------|------|-----------|-----------|
| 1 | 2025-08-10 | Team A | Team D |
| 1 | 2025-08-10 | Team B | Team C |
| 2 | 2025-08-17 | Team A | Team C |
| 2 | 2025-08-17 | Team D | Team B |
| ... | ... | ... | ... |

## Technical Details

- **Pure HTML/CSS/JavaScript** - no dependencies except SheetJS for Excel export
- **Works offline** after first load
- **No server required** - runs entirely in the browser
- **Modern, responsive design**

## Future Enhancements

Potential features we could add:
- Multiple fields/locations
- Game times
- Divisions/age groups
- Email schedule distribution
- Discord bot integration
- Print-friendly format
- Season standings tracker

## License

Free to use and modify for your league!

## Questions or Issues?

Open an issue on GitHub and we'll help you out!
