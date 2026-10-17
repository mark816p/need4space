// src/changelog.js — Version registry and release changelog (newest first)
// Why: The title screen and settings menu show the latest version and patch notes

export const CHANGELOG = [
  {
    version: '1.0',
    title: 'First flight',
    date: '2024-10-11',
    notes: [
      'The Feather S1, eight rivals and the space circuit'
    ]
  }
];

export const CURRENT_VERSION = CHANGELOG[0].version;
