# Jonathan Blades | Professional Résumé

A lightweight, accessible online résumé for Jonathan Blades, a Senior Front-End Engineer specialising in Angular, TypeScript, UX and accessibility.

## Live site

My accessible online résumé, built with semantic HTML and modern CSS.

[View my published résumé](https://bladeski.github.io/resume/)

## About

This site summarises my professional experience, technical skills, selected work, education and ongoing professional development.

My experience includes:

- Senior front-end engineering
- Angular and TypeScript development
- UX and interaction design
- Web accessibility
- Automated testing
- Reusable component architecture
- Azure DevOps and CI/CD
- Technical leadership, mentoring and line management
- Enterprise infrastructure and systems administration

## Selected work

The résumé includes selected examples of my professional and personal work, including:

### Transport asset-management platform

Front-end engineering and UX work on an enterprise application used by approximately 600 people to support the management of critical transport infrastructure across Scotland.

### Reusable front-end architecture and quality improvements

The creation of reusable Angular components, shared implementation patterns and automated tests to reduce duplicated code, improve consistency and increase confidence in application changes.

### scan-compromised

A self-contained, CI-friendly npm command-line tool for identifying packages associated with known software supply-chain compromises.

[View scan-compromised on GitHub](https://github.com/bladeski/scan-compromised)

## Accessibility

Accessibility is treated as a core requirement of the site rather than an optional enhancement.

The implementation includes:

- Semantic HTML landmarks and headings
- A skip link for keyboard users
- Visible keyboard focus indicators
- Native links and form controls
- Responsive layouts supporting narrow viewports and browser zoom
- Light and dark colour-scheme support
- Windows forced-colour support
- Print-specific presentation
- Machine-readable dates
- Meaningful link text
- Progressive enhancement
- A page that remains usable without JavaScript

The content and interaction patterns are designed with WCAG-informed practices in mind.

## Design and technical approach

The site deliberately uses a small and resilient technology stack:

- Semantic HTML
- Modern CSS
- CSS custom properties
- CSS nesting
- Responsive media queries
- `prefers-color-scheme`
- `light-dark()`
- `color-mix()`
- `contrast-color()`
- `:has()`
- Print styles

There is no application framework, build process or client-side JavaScript dependency. This helps keep the site fast, portable and easy to maintain.

## Project structure

```text
resume/
├── index.html
├── styles.css
└── README.md
