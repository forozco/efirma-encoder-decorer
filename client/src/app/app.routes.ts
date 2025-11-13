import { Routes } from '@angular/router';
import { EfirmaComponent } from './efirma/efirma.component';
import { EfirmaLocalComponent } from './efirma-local/efirma-local.component';
import { DecodeBase64Component } from './decode-base64/decode-base64.component';

export const routes: Routes = [
  { path: '', component: EfirmaComponent },
  { path: 'efirma-local', component: EfirmaLocalComponent },
  { path: 'decode-base64', component: DecodeBase64Component },
  { path: '**', redirectTo: '' }
];
