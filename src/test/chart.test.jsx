import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Chart from '../components/charts/Chart.jsx';

const sampleData = [
  { label: 'Jan', value: 100 },
  { label: 'Feb', value: 200 },
  { label: 'Mar', value: 150 },
];

describe('Chart', () => {
  describe('bar chart (default)', () => {
    it('renders an SVG element', () => {
      const { container } = render(<Chart data={sampleData} type="bar" />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders a rect for each data point', () => {
      const { container } = render(<Chart data={sampleData} type="bar" />);
      const rects = container.querySelectorAll('rect');
      expect(rects.length).toBe(sampleData.length);
    });

    it('renders label text for each data point', () => {
      render(<Chart data={sampleData} type="bar" />);
      expect(screen.getByText('Jan')).toBeTruthy();
      expect(screen.getByText('Feb')).toBeTruthy();
      expect(screen.getByText('Mar')).toBeTruthy();
    });

    it('renders empty state when data is empty', () => {
      render(<Chart data={[]} type="bar" />);
      expect(screen.getByText('Belum ada data.')).toBeTruthy();
    });

    it('renders title when provided', () => {
      render(<Chart data={sampleData} type="bar" title="Revenue Chart" />);
      expect(screen.getByText('Revenue Chart')).toBeTruthy();
    });

    it('uses custom formatValue for bar labels', () => {
      render(
        <Chart
          data={[{ label: 'A', value: 1000 }]}
          type="bar"
          formatValue={(n) => `Rp${n}`}
        />
      );
      expect(screen.getByText('Rp1000')).toBeTruthy();
    });
  });

  describe('line chart', () => {
    it('renders an SVG element', () => {
      const { container } = render(<Chart data={sampleData} type="line" />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders a polyline element', () => {
      const { container } = render(<Chart data={sampleData} type="line" />);
      expect(container.querySelector('polyline')).toBeTruthy();
    });

    it('renders a gradient area fill', () => {
      const { container } = render(<Chart data={sampleData} type="line" />);
      expect(container.querySelector('linearGradient')).toBeTruthy();
      expect(container.querySelector('path')).toBeTruthy();
    });

    it('renders dot circles for each data point', () => {
      const { container } = render(<Chart data={sampleData} type="line" />);
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(sampleData.length);
    });

    it('renders empty state when data is empty', () => {
      render(<Chart data={[]} type="line" />);
      expect(screen.getByText('Belum ada data.')).toBeTruthy();
    });

    it('renders title when provided', () => {
      render(<Chart data={sampleData} type="line" title="Visit Trend" />);
      expect(screen.getByText('Visit Trend')).toBeTruthy();
    });
  });

  describe('hbar chart (horizontal bar)', () => {
    it('renders hbar-chart container', () => {
      const { container } = render(<Chart data={sampleData} type="hbar" />);
      expect(container.querySelector('.hbar-chart')).toBeTruthy();
    });

    it('renders a row for each data point', () => {
      const { container } = render(<Chart data={sampleData} type="hbar" />);
      const rows = container.querySelectorAll('.hbar-row');
      expect(rows.length).toBe(sampleData.length);
    });

    it('renders label for each data point', () => {
      render(<Chart data={sampleData} type="hbar" />);
      expect(screen.getByText('Jan')).toBeTruthy();
      expect(screen.getByText('Feb')).toBeTruthy();
      expect(screen.getByText('Mar')).toBeTruthy();
    });

    it('renders empty state when data is empty', () => {
      render(<Chart data={[]} type="hbar" />);
      expect(screen.getByText('Belum ada data.')).toBeTruthy();
    });

    it('renders title when provided', () => {
      render(<Chart data={sampleData} type="hbar" title="Top Products" />);
      expect(screen.getByText('Top Products')).toBeTruthy();
    });

    it('sets hbar-fill width proportional to value', () => {
      const data = [
        { label: 'A', value: 100 },
        { label: 'B', value: 50 },
      ];
      const { container } = render(<Chart data={data} type="hbar" />);
      const fills = container.querySelectorAll('.hbar-fill');
      // Max value (100) should be 100%, half value (50) should be 50%
      expect(fills[0].style.width).toBe('100%');
      expect(fills[1].style.width).toBe('50%');
    });
  });

  describe('chart-card wrapper', () => {
    it('wraps bar chart in chart-card div', () => {
      const { container } = render(<Chart data={sampleData} type="bar" />);
      expect(container.querySelector('.chart-card')).toBeTruthy();
    });

    it('wraps line chart in chart-card div', () => {
      const { container } = render(<Chart data={sampleData} type="line" />);
      expect(container.querySelector('.chart-card')).toBeTruthy();
    });

    it('wraps hbar chart in chart-card div', () => {
      const { container } = render(<Chart data={sampleData} type="hbar" />);
      expect(container.querySelector('.chart-card')).toBeTruthy();
    });
  });

  describe('default props', () => {
    it('defaults to bar chart when type is omitted', () => {
      const { container } = render(<Chart data={sampleData} />);
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('defaults to empty array when data is omitted', () => {
      render(<Chart type="bar" />);
      expect(screen.getByText('Belum ada data.')).toBeTruthy();
    });
  });
});
