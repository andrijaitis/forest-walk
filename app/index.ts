import { registerRootComponent } from 'expo';

// Defines the background location task. Must be imported before anything else,
// so it exists when Android wakes the app headless to deliver locations.
import './src/tracking';

import App from './App';

registerRootComponent(App);
