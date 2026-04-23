import { Card } from 'react-bootstrap';
import './StatCard.css';

// Jasa Marga brand color definitions
const JM_COLORS = {
  'jm-blue': {
    cardBg: '#003087',
    titleColor: 'rgba(255,255,255,0.75)',
    valueColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.65)',
    percentageColor: '#7EC8E3',
    iconBg: 'rgba(255,255,255,0.15)',
    progressTrack: 'rgba(255,255,255,0.25)',
    progressBar: '#ffffff',
  },
  'jm-yellow': {
    cardBg: '#FDB913',
    titleColor: 'rgba(0,0,0,0.65)',
    valueColor: '#1a1a1a',
    subtitleColor: 'rgba(0,0,0,0.55)',
    percentageColor: '#5a3e00',
    iconBg: 'rgba(0,0,0,0.10)',
    progressTrack: 'rgba(0,0,0,0.15)',
    progressBar: '#003087',
  },
};

const StatCard = ({ title, value, icon: Icon, color, percentage, subtitle }) => {
  const isImagePath = typeof Icon === 'string';
  const jmStyle = JM_COLORS[color] || null;

  return (
    <Card
      className="stat-card border-0 shadow-sm h-100 hover-lift"
      style={jmStyle ? { backgroundColor: jmStyle.cardBg } : {}}
    >
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div className="flex-grow-1">
            <p
              className="mb-1 small fw-medium text-uppercase"
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.5px',
                color: jmStyle ? jmStyle.titleColor : undefined,
              }}
            >
              {title}
            </p>
            <h4
              className="fw-bold mb-0"
              style={{
                fontSize: '1.5rem',
                color: jmStyle ? jmStyle.valueColor : undefined,
              }}
            >
              {value}
            </h4>

            {subtitle && (
              <small
                className="d-block mt-1"
                style={{ color: jmStyle ? jmStyle.subtitleColor : 'var(--bs-secondary)' }}
              >
                {subtitle}
              </small>
            )}

            {percentage && (
              <small
                className="fw-bold d-flex align-items-center mt-1"
                style={{ color: jmStyle ? jmStyle.percentageColor : 'var(--bs-success)' }}
              >
                <span className="me-1">📈</span>
                {percentage}
              </small>
            )}
          </div>

          <div
            className="icon-wrapper rounded-circle d-flex align-items-center justify-content-center"
            style={{
              width: '48px',
              height: '48px',
              minWidth: '48px',
              backgroundColor: jmStyle ? jmStyle.iconBg : undefined,
            }}
            {...(!jmStyle && {
              className: `icon-wrapper bg-${color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`,
            })}
          >
            {isImagePath ? (
              <img
                src={Icon}
                alt={title}
                style={{
                  width: '24px',
                  height: '24px',
                  objectFit: 'contain',
                  filter: jmStyle ? 'brightness(0) invert(1)' : undefined,
                }}
              />
            ) : (
              <Icon
                className={!jmStyle ? `text-${color}` : undefined}
                style={jmStyle ? { color: '#fff' } : {}}
                size={24}
              />
            )}
          </div>
        </div>

        {percentage && (
          <div className="mt-auto">
            <div
              className="progress"
              style={{
                height: '4px',
                backgroundColor: jmStyle ? jmStyle.progressTrack : undefined,
              }}
            >
              <div
                className={!jmStyle ? `progress-bar bg-${color}` : 'progress-bar'}
                role="progressbar"
                style={{
                  width: percentage,
                  ...(jmStyle && { backgroundColor: jmStyle.progressBar }),
                }}
                aria-valuenow={parseFloat(percentage)}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatCard;