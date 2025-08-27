import { Routes } from '@angular/router';
import { EfirmaComponent } from './efirma/efirma.component';

export const routes: Routes = [
  { path: '', component: EfirmaComponent },
  { path: '**', redirectTo: '' }
];
