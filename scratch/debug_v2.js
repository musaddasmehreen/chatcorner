const fs = require('fs');
const jsCode = fs.readFileSync('js/chat-v2.js', 'utf8');

// Simple DOM Mock
const mockChannelSelect = {
  innerHTML: '',
  disabled: false,
  options: [],
  appendChild(child) {
    this.options.push(child);
  }
};

const mockDocument = {
  getElementById(id) {
    if (id === 'radio-channel-select') return mockChannelSelect;
    if (id === 'radio-country-select') return { value: 'PK' };
    return null;
  },
  createElement(tag) {
    if (tag === 'option') {
      return { value: '', textContent: '' };
    }
    return {};
  }
};
global.document = mockDocument;

// Evaluate the script by extracting the RADIO_PLAYLISTS and onRadioCountryChange functions
const playlistsMatch = jsCode.match(/const RADIO_PLAYLISTS = \{[\s\S]*?\};/);
const onCountryChangeMatch = jsCode.match(/function onRadioCountryChange[\s\S]*?\n\}/);

if (playlistsMatch && onCountryChangeMatch) {
  // Extract and eval
  const sandbox = {
    document: mockDocument,
    RADIO_PLAYLISTS: null,
    onRadioCountryChange: null
  };
  
  eval(playlistsMatch[0] + '\n' + onCountryChangeMatch[0] + '\n' + 'onRadioCountryChange = onRadioCountryChange;');
  
  // Run it
  onRadioCountryChange('PK');
  
  console.log('--- Results for PK ---');
  console.log('Disabled:', mockChannelSelect.disabled);
  console.log('HTML:', mockChannelSelect.innerHTML);
  console.log('Options length:', mockChannelSelect.options.length);
  mockChannelSelect.options.forEach((opt, idx) => {
    console.log(`Option ${idx + 1}: value="${opt.value}" text="${opt.textContent}"`);
  });
} else {
  console.log('Matches not found!');
  if (!playlistsMatch) console.log('RADIO_PLAYLISTS match failed');
  if (!onCountryChangeMatch) console.log('onRadioCountryChange match failed');
}
