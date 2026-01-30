/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/*", "./app/(tabs)/*", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#3E2723",
        secondary: "#D7CCC8",
        accent: "#8D6E63",
        "background-light": "#FAFAFA",
        "background-dark": "#121212",
        "surface-light": "#FFFFFF",
        "surface-dark": "#1E1E1E",
        "text-light": "#2D2D2D",
        "text-dark": "#E0E0E0",
      },
    },
  },
  plugins: [],
}