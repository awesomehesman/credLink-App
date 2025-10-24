import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app/app.routes';
import { AppRoot } from './app/app';

// // 🧹 Clear all local development data (optional, for testing only)
// if (window.location.hostname === 'localhost') {
//   try {
//     // Clear localStorage and sessionStorage
//     localStorage.clear();
//     sessionStorage.clear();

//     // Clear all IndexedDB databases
//     if (indexedDB && indexedDB.databases) {
//       indexedDB.databases().then((dbs) => {
//         dbs.forEach((db) => {
//           if (db.name) indexedDB.deleteDatabase(db.name);
//         });
//       });
//     } else {
//       // Fallback for older browsers
//       const req = indexedDB.open('dummy');
//       req.onsuccess = () => indexedDB.deleteDatabase('dummy');
//     }

//     console.log('%c✅ Local app data cleared for a fresh start.', 'color: #2bb89a');
//   } catch (err) {
//     console.warn('⚠️ Could not clear local data:', err);
//   }
// }

// 🚀 Bootstrap the Angular application
bootstrapApplication(AppRoot, {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideAnimations(), // keep animations enabled
  ],
}).catch(console.error);