import { Card } from 'react-bootstrap';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// ✅ UPDATED: ChartCard dengan enhanced options untuk better visualization
const ChartCard = ({ title, type = 'doughnut', data, subtitle }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          usePointStyle: true,
          font: {
            size: 12,
            family: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
          },
          boxWidth: 12,
          boxHeight: 12
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            
            // Jika nilai kecil (jumlah paket), tampilkan sebagai "X paket"
            // Jika nilai besar (rupiah), tampilkan sebagai currency
            const formattedValue = value > 1000 
              ? new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(value)
              : `${value} paket`;
            
            return `${label}: ${formattedValue} (${percentage}%)`;
          }
        }
      }
    },
    // ✅ Animation
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    // ✅ Cutout for doughnut (makes it look more modern)
    cutout: type === 'doughnut' ? '60%' : undefined
  };

  // ✅ Select chart type
  const ChartComponent = type === 'pie' ? Pie : Doughnut;

  return (
    <Card className="shadow-sm border-0 h-100 hover-lift">
      <Card.Header className="bg-white border-0 py-3">
        <h6 className="mb-0 fw-bold text-center">{title}</h6>
        {/* ✅ Optional subtitle */}
        {subtitle && (
          <p className="text-muted text-center mb-0 mt-1" style={{ fontSize: '0.75rem' }}>
            {subtitle}
          </p>
        )}
      </Card.Header>
      <Card.Body className="d-flex align-items-center justify-content-center p-4">
        <div style={{ maxWidth: '300px', width: '100%' }}>
          <ChartComponent data={data} options={options} />
        </div>
      </Card.Body>
    </Card>
  );
};

export default ChartCard;