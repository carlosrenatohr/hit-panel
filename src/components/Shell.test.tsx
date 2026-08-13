import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/preact';
import Shell from './Shell';
import type { SessionUser } from '../lib/types';

function makeUser(agency: SessionUser['agency']): SessionUser {
  return { id: 'u-1', email: 'x@hit-cargo.com', role: 'admin', name: 'Test User', agency };
}

describe('Shell branding', () => {
  it('renders the HIT Cargo brand for agency hit', () => {
    render(<Shell user={makeUser('hit')} view="overview" onView={() => {}} onLogout={() => {}}>x</Shell>);
    const logos = screen.getAllByAltText('HIT Cargo');
    expect(logos).toHaveLength(2);
    expect(logos[0].getAttribute('src')).toBe('/logo-mark.png');
    expect(screen.getAllByText('HIT Cargo').length).toBeGreaterThan(0);
  });

  it('renders the Suite Cargo brand for agency suite', () => {
    render(<Shell user={makeUser('suite')} view="overview" onView={() => {}} onLogout={() => {}}>x</Shell>);
    const logos = screen.getAllByAltText('Suite Cargo');
    expect(logos).toHaveLength(2);
    expect(logos[0].getAttribute('src')).toBe('/suite-cargo-demo-logo.png');
    expect(screen.getAllByText('Suite Cargo').length).toBeGreaterThan(0);
  });
});