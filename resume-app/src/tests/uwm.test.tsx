import { render, screen } from '@testing-library/react';
import * as UWM from '../components/uwm';

describe('UWMImage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders link with correct href', () => {
    const Component = UWM.default;
    render(<Component imageUrl="/uwm.png" linkUrl="https://uwm.edu/" altText="UWM" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://uwm.edu/');
  });

  it('renders image with alt text', () => {
  const Component = UWM.default;
  render(<Component imageUrl="/uwm.png" linkUrl="https://uwm.edu/" altText="UWM" />);
    expect(screen.getByAltText('UWM')).toBeInTheDocument();
  });
});
