import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="container">
      <h1>Acceso con e.firma — POC Angular 20</h1>
      <router-outlet></router-outlet>
    </div>
  `
})
export class AppComponent {}
