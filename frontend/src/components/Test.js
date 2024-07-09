import React from 'react';
import { useTable, useSortBy } from 'react-table';

import Header from './Header';

function Table({ columns, data }) {
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data }, useSortBy);

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                {/* Add a sort direction indicator */}
                <span>
                  {column.isSorted
                    ? column.isSortedDesc
                      ? ' 🔽'
                      : ' 🔼'
                    : ''}
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, index) => {
          prepareRow(row);
          return (
            <tr key={index} className={index % 2 === 0 ? 'table-content-even' : 'table-content-odd'} {...row.getRowProps()}>
              {row.cells.map(cell => (
                <td {...cell.getCellProps()}>{cell.render('Cell')}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Test() {
  const data = React.useMemo(
    () => [
      {
        col1: 'Hello 1',
        col2: 'World 1',
      },
      {
        col1: 'React 2',
        col2: 'Table 2',
      },
      {
        col1: 'React 3',
        col2: 'Table 3',
      },
      {
        col1: 'React 4',
        col2: 'Table 4',
      },
      // more data...
    ],
    []
  );

  const columns = React.useMemo(
    () => [
      {
        Header: 'Super Header',
        columns: [
          {
            Header: 'Column 1',
            accessor: 'col1',
          },
          {
            Header: 'Column 2',
            accessor: 'col2',
          },
          // more columns...
        ],
      },
    ],
    []
  );

  return (
    <div style={{ flex: 1, flexBasis: 'auto', flexDirection: 'column', height: 'calc(100vh - 80px - 20px)', width: 'calc(100vw - 40px)', gap: '20px' , margin: '0', padding: '20px' }}>
      <Header />
      <Table columns={columns} data={data} />
    </div>
  );
}

export default Test;