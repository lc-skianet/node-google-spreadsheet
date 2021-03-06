const _ = require('lodash');

const docs = require('./load-test-docs')();
const creds = require('./service-account-creds.json');

const doc = docs.private;

let sheet;
let rows;
let row;

const HEADERS = ['numbers', 'letters', 'col1', 'col2', 'col3'];
const INITIAL_DATA = [
  ['0', 'A'],
  ['1', 'B'],
  ['2', 'C'],
  ['3', 'D'],
  ['4', 'E'],
];

describe('Row-based operations', () => {
  beforeAll(async () => {
    await doc.useServiceAccountAuth(creds);
    sheet = await doc.addSheet({ headers: HEADERS });
    for (let i = 0; i < INITIAL_DATA.length; i++) {
      await sheet.addRow(INITIAL_DATA[i]);
    }
  });
  afterAll(async () => {
    await sheet.delete();
  });

  describe('fetching rows', () => {
    it('can fetch multiple rows', async () => {
      rows = await sheet.getRows();
      row = rows[0];
      expect(rows.length).toEqual(5);
    });

    it('a row has properties with keys from the headers', () => {
      expect(rows[0].numbers).toEqual(INITIAL_DATA[0][0]);
      expect(rows[0].letters).toEqual(INITIAL_DATA[0][1]);
    });

    it('supports `offset` option', async () => {
      rows = await sheet.getRows({ offset: 2 });
      expect(rows.length).toEqual(3);
      expect(rows[0].numbers).toEqual(INITIAL_DATA[2][0]);
    });

    it('supports `limit` option', async () => {
      rows = await sheet.getRows({ limit: 3 });
      expect(rows.length).toEqual(3);
      expect(rows[0].numbers).toEqual(INITIAL_DATA[0][0]);
    });

    it('supports combined `limit` and `offset`', async () => {
      rows = await sheet.getRows({ offset: 2, limit: 2 });
      expect(rows.length).toEqual(2);
      expect(rows[0].numbers).toEqual(INITIAL_DATA[2][0]);
    });
  });

  describe('adding rows', () => {
    it('can add a row with an array of values', async () => {
      const newRowData = ['5', 'F'];
      row = await sheet.addRow(newRowData);
      expect(row.numbers).toEqual(newRowData[0]);
      expect(row.letters).toEqual(newRowData[1]);
      expect(row.dates).toEqual(newRowData[2]);
    });

    it('persisted the row', async () => {
      rows = await sheet.getRows();
      expect(rows.length).toEqual(INITIAL_DATA.length + 1);
      const newRowIndex = INITIAL_DATA.length;
      expect(rows[newRowIndex].numbers).toEqual(row.numbers);
      expect(rows[newRowIndex].letters).toEqual(row.letters);
      expect(rows[newRowIndex].dates).toEqual(row.dates);
    });

    it('can add a row with keyed object data', async () => {
      const newRowData = {
        numbers: '6',
        letters: 'G',
      };
      row = await sheet.addRow(newRowData);
      expect(row.numbers).toEqual(newRowData.numbers);
      expect(row.letters).toEqual(newRowData.letters);
    });
  });

  describe('deleting rows', () => {
    it('can delete a row', async () => {
      rows = await sheet.getRows();

      const numRows = rows.length;

      // delete the row with number === 1
      row = rows[1];
      await row.del();

      // make sure we have 1 less row
      rows = await sheet.getRows();
      expect(rows.length).toEqual(numRows - 1);

      // make sure we deleted the correct row
      expect(rows[0].numbers).toEqual('0');
      expect(rows[1].numbers).toEqual('2');
    });

    it('cannot delete a row twice', async () => {
      await expect(row.del()).rejects.toThrow();
    });

    it('cannot update a deleted row', async () => {
      row.col1 = 'new value';
      await expect(row.save()).rejects.toThrow();
    });
  });

  describe('updating rows', () => {
    it('can update a row', async () => {
      rows = await sheet.getRows();
      row = rows[0];

      row.numbers = '999';
      row.letters = 'Z';
      await row.save();
      expect(row.numbers).toBe('999');
      expect(row.letters).toBe('Z');
    });

    it('persisted the row update', async () => {
      rows = await sheet.getRows();
      expect(rows[0].numbers).toEqual(row.numbers);
      expect(rows[0].letters).toEqual(row.letters);
    });

    it('can write a formula', async () => {
      row.col1 = 1;
      row.col2 = 2;
      row.col3 = '=C2+D2'; // col1 is column C
      await row.save();
      expect(row.col1).toEqual('1'); // it converts to strings
      expect(row.col2).toEqual('2');
      expect(row.col3).toEqual('3'); // it evaluates the formula and formats as a string
    });

    describe('encoding and odd characters', () => {
      _.each(
        {
          'new lines': 'new\n\nlines\n',
          'special chars': '∑πécial <> chårs = !\t',
        },
        (value, description) => {
          it(`supports ${description}`, async () => {
            row.col1 = value;
            await row.save();

            rows = await sheet.getRows();
            expect(rows[0].col1).toEqual(value);
          });
        },
      );
    });
  });
});
