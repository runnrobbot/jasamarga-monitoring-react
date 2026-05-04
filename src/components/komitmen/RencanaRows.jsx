import { Table, Form, Button, InputGroup } from 'react-bootstrap';
import { FaPlus, FaTrash } from 'react-icons/fa';

const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

/**
 * Dynamic rows input untuk rencana realisasi per tahun.
 * @param {Object} props
 * @param {Array} props.rows - Array of rencana row objects
 * @param {Function} props.onChange - (index, field, value) => void
 * @param {Function} props.onRupiahChange - (index, value) => void
 * @param {Function} props.onAdd - () => void
 * @param {Function} props.onRemove - (index) => void
 * @param {boolean} [props.disabled=false]
 */
const RencanaRows = ({
  rows,
  onChange,
  onRupiahChange,
  onAdd,
  onRemove,
  disabled = false,
}) => {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <small className="text-muted fw-semibold">Rencana Realisasi per Tahun</small>
        {!disabled && (
          <Button variant="outline-primary" size="sm" onClick={onAdd}>
            <FaPlus className="me-1" /> Tambah Baris
          </Button>
        )}
      </div>

      <div className="table-responsive">
        <Table bordered size="sm" className="mb-0">
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Tahun</th>
              <th>Bulan</th>
              <th>Nilai Rencana</th>
              <th>Keterangan</th>
              {!disabled && <th style={{ width: 50 }}>Hapus</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || index}>
                <td className="text-center">{index + 1}</td>
                <td>
                  <Form.Control
                    size="sm"
                    type="number"
                    min="2020"
                    max="2099"
                    placeholder="2025"
                    value={row.tahunRencana}
                    onChange={(e) => onChange(index, 'tahunRencana', e.target.value)}
                    disabled={disabled}
                  />
                </td>
                <td>
                  <Form.Select
                    size="sm"
                    value={row.bulanRencana}
                    onChange={(e) => onChange(index, 'bulanRencana', e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Pilih Bulan</option>
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </Form.Select>
                </td>
                <td>
                  <InputGroup size="sm">
                    <InputGroup.Text>Rp</InputGroup.Text>
                    <Form.Control
                      value={row.nilaiRencana}
                      onChange={(e) => onRupiahChange(index, e.target.value)}
                      placeholder="0"
                      disabled={disabled}
                    />
                  </InputGroup>
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    value={row.keterangan}
                    onChange={(e) => onChange(index, 'keterangan', e.target.value)}
                    placeholder="Keterangan"
                    disabled={disabled}
                  />
                </td>
                {!disabled && (
                  <td className="text-center">
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => onRemove(index)}
                    >
                      <FaTrash />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default RencanaRows;
