const express = require('express');
const db = require('../db');

const router = express.Router();

function apiResponse(res, status, message, data = null) {
  const body = { success: status >= 200 && status < 300, message };
  if (data !== null) {
    body.data = data;
  }
  return res.status(status).json(body);
}

function parseQuantity(value, fallback = 1) {
  const quantity = Number.parseInt(value, 10);
  if (Number.isNaN(quantity) || quantity < 0) {
    return null;
  }
  return quantity ?? fallback;
}

function normalizeNumber(value) {
  return String(value ?? '').trim();
}

function normalizeType(value) {
  const type = String(value ?? 'DMC').trim();
  return type.length > 0 ? type : 'DMC';
}

function isConfirmed(req) {
  return (
    req.body?.confirm === true ||
    req.query.confirm === 'true' ||
    req.query.confirm === '1'
  );
}

function getFlossById(id) {
  if (Number.isNaN(id)) {
    return { error: { status: 400, message: 'Invalid floss id' } };
  }

  const existing = db
    .prepare('SELECT id, number, type, quantity, created_at, updated_at FROM flosses WHERE id = ?')
    .get(id);

  if (!existing) {
    return { error: { status: 404, message: `Floss with id ${id} not found` } };
  }

  return { existing };
}

router.get('/', (req, res) => {
  const { number, type, minQuantity } = req.query;
  const conditions = [];
  const params = [];

  if (number !== undefined && number !== '') {
    conditions.push('number LIKE ?');
    params.push(`%${normalizeNumber(number)}%`);
  }

  if (type !== undefined && type !== '') {
    conditions.push('type LIKE ?');
    params.push(`%${normalizeType(type)}%`);
  }

  if (minQuantity !== undefined && minQuantity !== '') {
    const min = parseQuantity(minQuantity, 0);
    if (min === null) {
      return apiResponse(res, 400, 'minQuantity must be a non-negative integer');
    }
    conditions.push('quantity >= ?');
    params.push(min);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const flosses = db
    .prepare(`SELECT id, number, type, quantity, created_at, updated_at FROM flosses ${where} ORDER BY type, number`)
    .all(...params);

  return apiResponse(res, 200, `Listed ${flosses.length} floss${flosses.length === 1 ? '' : 'es'}`, flosses);
});

router.post('/', (req, res) => {
  const number = normalizeNumber(req.body.number);
  const type = normalizeType(req.body.type);
  const quantity = parseQuantity(req.body.quantity, 1);

  if (!number) {
    return apiResponse(res, 400, 'number is required');
  }

  if (quantity === null || quantity < 1) {
    return apiResponse(res, 400, 'quantity must be a positive integer');
  }

  const existing = db
    .prepare('SELECT id, number, type, quantity FROM flosses WHERE number = ? AND type = ?')
    .get(number, type);

  if (existing) {
    const updated = db
      .prepare(
        `UPDATE flosses
         SET quantity = quantity + ?, updated_at = datetime('now')
         WHERE id = ?
         RETURNING id, number, type, quantity, created_at, updated_at`
      )
      .get(quantity, existing.id);

    return apiResponse(
      res,
      200,
      `Updated quantity for ${updated.type} #${updated.number} (now ${updated.quantity})`,
      updated
    );
  }

  const created = db
    .prepare(
      `INSERT INTO flosses (number, type, quantity)
       VALUES (?, ?, ?)
       RETURNING id, number, type, quantity, created_at, updated_at`
    )
    .get(number, type, quantity);

  return apiResponse(res, 201, `Added ${created.type} #${created.number} (quantity ${created.quantity})`, created);
});

router.patch('/:id/subtract', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const quantity = parseQuantity(req.body.quantity, null);
  const lookup = getFlossById(id);

  if (lookup.error) {
    return apiResponse(res, lookup.error.status, lookup.error.message);
  }

  const { existing } = lookup;

  if (quantity === null || quantity < 1) {
    return apiResponse(res, 400, 'quantity must be a positive integer');
  }

  if (quantity > existing.quantity) {
    return apiResponse(
      res,
      400,
      `Cannot subtract ${quantity}; only ${existing.quantity} available for ${existing.type} #${existing.number}`
    );
  }

  const willRemoveEntry = quantity === existing.quantity;

  if (willRemoveEntry && !isConfirmed(req)) {
    return apiResponse(
      res,
      400,
      'Subtracting all remaining quantity requires confirmation. Set confirm=true in query or { "confirm": true } in body.'
    );
  }

  if (willRemoveEntry) {
    db.prepare('DELETE FROM flosses WHERE id = ?').run(id);

    return apiResponse(
      res,
      200,
      `Removed ${existing.type} #${existing.number} after subtracting ${quantity} (none remaining)`,
      { ...existing, removed: true, subtracted: quantity, quantity: 0 }
    );
  }

  const updated = db
    .prepare(
      `UPDATE flosses
       SET quantity = quantity - ?, updated_at = datetime('now')
       WHERE id = ?
       RETURNING id, number, type, quantity, created_at, updated_at`
    )
    .get(quantity, id);

  return apiResponse(
    res,
    200,
    `Subtracted ${quantity} from ${updated.type} #${updated.number} (now ${updated.quantity})`,
    { ...updated, removed: false, subtracted: quantity }
  );
});

router.delete('/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const lookup = getFlossById(id);

  if (lookup.error) {
    return apiResponse(res, lookup.error.status, lookup.error.message);
  }

  const { existing } = lookup;

  if (!isConfirmed(req)) {
    return apiResponse(res, 400, 'Destructive action requires confirmation. Set confirm=true in query or { "confirm": true } in body.');
  }

  db.prepare('DELETE FROM flosses WHERE id = ?').run(id);

  return apiResponse(
    res,
    200,
    `Removed ${existing.type} #${existing.number} (quantity was ${existing.quantity})`,
    existing
  );
});

module.exports = router;
