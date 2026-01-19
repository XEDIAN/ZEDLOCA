# Switch from OpenAI to Google AI for Gemini

## Tasks to Complete
- [x] Remove "openai": "^6.16.0" from package.json dependencies
- [x] Update src/components/AIChatbot.jsx:
  - [x] Change import from OpenAI to @google/generative-ai
  - [x] Replace OpenAI initialization with GoogleGenerativeAI
  - [x] Update sendMessage function to use Google's generateContent API
  - [x] Change UI text from "Powered by OpenAI" to "Powered by Google Gemini"
  - [x] Update error messages and footer text
- [x] Update .env to use VITE_GOOGLE_AI_API_KEY instead of VITE_OPENAI_API_KEY
- [x] Update TODO.md to reflect the switch to Google AI
- [x] Run npm install to update dependencies
- [x] Test the chatbot functionality
