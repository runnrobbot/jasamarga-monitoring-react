import { Card } from 'react-bootstrap';
import './StatCard.css';

// ✅ UPDATED: StatCard dengan enhanced styling dan support untuk PIC/Admin
const StatCard = ({ title, value, icon: Icon, color, percentage, subtitle }) => {
  const isImagePath = typeof Icon === 'string';
  
  return (
    <Card className="stat-card border-0 shadow-sm h-100 hover-lift">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="flex-grow-1">
            <p className="text-muted mb-1 small fw-medium text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              {title}
            </p>
            <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.5rem' }}>
              {value}
            </h4>
            
            {/* ✅ Subtitle (optional - for additional context) */}
            {subtitle && (
              <small className="text-muted d-block mt-1">
                {subtitle}
              </small>
            )}
            
            {/* ✅ Percentage indicator */}
            {percentage && (
              <small className="text-success fw-bold d-flex align-items-center mt-1">
                <span className="me-1">📈</span>
                {percentage}
              </small>
            )}
          </div>
          <div 
            className={`icon-wrapper bg-${color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`}
            style={{
              width: '48px',
              height: '48px',
              minWidth: '48px'
            }}
          >
            {isImagePath ? (
              <img 
                src={Icon} 
                alt={title}
                style={{ width: '24px', height: '24px', objectFit: 'contain' }}
              />
            ) : (
              <Icon className={`text-${color}`} size={24} />
            )}
          </div>
        </div>
        
        {/* ✅ Progress indicator for percentage */}
        {percentage && (
          <div className="mt-auto">
            <div className="progress" style={{ height: '4px' }}>
              <div 
                className={`progress-bar bg-${color}`}
                role="progressbar"
                style={{ width: percentage }}
                aria-valuenow={parseFloat(percentage)}
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatCard;