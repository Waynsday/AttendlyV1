# Romoland Design Token Extraction

This directory contains the Puppeteer script for extracting design tokens from the Romoland School District website (https://www.romoland.net) to create a matching theme for the AttendlyV1 application.

## Files

- `scrapeRomoland.ts` - Main extraction script with MCP Puppeteer integration
- `../design-tokens.json` - Extracted design tokens in JSON format (project root)

## Usage

### Quick Start
```bash
npm run scrape-design           # Run with headless browser
npm run scrape-design:headful   # Run with visible browser for debugging
```

### Manual MCP Puppeteer Integration

For live extraction using Claude Code's MCP Puppeteer tools:

1. **Navigate to site:**
   ```javascript
   mcp__puppeteer__puppeteer_navigate({
     url: "https://www.romoland.net"
   })
   ```

2. **Take screenshot for reference:**
   ```javascript
   mcp__puppeteer__puppeteer_screenshot({
     name: "romoland-homepage"
   })
   ```

3. **Extract tokens:**
   ```javascript
   mcp__puppeteer__puppeteer_evaluate({
     script: [GET_EXTRACTION_SCRIPT_FROM_getExtractionScript()]
   })
   ```

## Extracted Design Tokens

The script extracts the following design elements:

### Colors
- **Primary**: `#1e3a8a` (Dark blue from logo/branding)
- **Secondary**: `#64748b` (Professional gray)
- **Accent**: `#f97316` (Orange from logo - see accessibility note)
- **Text**: `#636363` (Medium gray text)
- **Background**: `#ffffff` (White)

### Typography
- **Primary**: `Montserrat, sans-serif` (Body text)
- **Headings**: `Syne, sans-serif` (Headers)

### Spacing
- **Button Padding**: `24px 30px 24px 40px` (From search input)
- **Card Padding**: `20px` (From content areas)

### Border Radius
- **Button**: `0.375rem` (6px)
- **Card**: `0.5rem` (8px)

### Shadows
- **Card**: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
- **Button**: `0 1px 2px 0 rgb(0 0 0 / 0.05)`

## Accessibility Notes

⚠️ **WCAG 2.1 AA Compliance**: The accent color (#f97316) has a contrast ratio of 3.28 with white background, which falls short of the WCAG 2.1 AA standard (4.5:1).

**Recommendation**: Consider using `#ea580c` for better accessibility while maintaining the orange brand color.

## Integration with Tailwind CSS

To use these tokens in your Tailwind configuration:

```javascript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: '#1e3a8a',
        secondary: '#64748b', 
        accent: '#f97316', // or '#ea580c' for better accessibility
        text: '#636363',
        background: '#ffffff'
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        headings: ['Syne', 'sans-serif']
      },
      spacing: {
        'btn': '24px 30px 24px 40px',
        'card': '20px'
      }
    }
  }
}
```

## Script Features

- **Timeout Protection**: 30-second maximum execution time
- **Error Handling**: Graceful fallback to default tokens
- **WCAG Validation**: Automatic contrast ratio checking
- **Headless/Headful Modes**: Debug with `--headful` flag
- **TypeScript Support**: Full type safety and IntelliSense
- **MCP Integration**: Works with Claude Code's Puppeteer tools

## Technical Implementation

The script uses several extraction strategies:

1. **CSS Computed Styles**: Extracts actual rendered styles from DOM elements
2. **Color Conversion**: Automatic RGB to Hex conversion
3. **Element Targeting**: Searches multiple selectors to find design elements
4. **Brand Analysis**: Identifies logo colors and school district branding
5. **Accessibility Testing**: Validates contrast ratios against WCAG standards

## Development

To modify the extraction logic:

1. Edit the `getExtractionScript()` function in `scrapeRomoland.ts`
2. Add new selectors to target different design elements
3. Update the `DesignTokens` interface for new token types
4. Test changes with `npm run scrape-design:headful`

## Security Considerations

- **Student Data**: Never extract or store any student information
- **Network Requests**: Only connects to public school district website
- **Data Privacy**: Extracted tokens contain only visual design information
- **FERPA Compliance**: No personal or educational data is accessed