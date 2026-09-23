/* global acquireVsCodeApi, createVsCodeHost, RelationsUi */
(() => {
  'use strict';
  RelationsUi(createVsCodeHost(acquireVsCodeApi(), window));
})();
