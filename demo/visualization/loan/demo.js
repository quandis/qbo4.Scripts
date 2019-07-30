document.addEventListener("qbo4.visualization.ready", function () {
    const db = new qbo4.visualization.dashboard({
        charts: [{
            'chartType': 'PieChart',
            'containerId': 'state_chart',
            'dimension': 'State',
            'options': {
                'height': 500,
                'pieHole': 0.4,
                'pieSliceText': 'value',
                'legend': 'right'
            }
        }, {
            'chartType': 'PieChart',
            'containerId': 'city_chart',
            'dimension': 'City',
            'filters': ['State'],
            'options': {
                'pieSliceText': 'value',
                'legend': 'right',
                'is3D': true,
                'x-sliceVisibilityThreshold': .1
            }
        }, {
            'chartType': 'Table',
            'filters': ['State', 'City'],
            'options': {
                'title': 'qbo4 Demo',
                'legend': 'none',
                'page': 'enable',
                'pageSize': 50,
                'allowHtml': true
            },
            'view': {
                columns: [
                    {
                        label: 'Loan', type: 'string', calc: (table, row) => {
                            const data = getRow(table, row);
                            return `<a target="_blank" href="/api/loan/${data.LoanID}">${data.Loan}</a>`;
                        }
                    },
                    3,
                    4,
                    {
                        label: 'Address', type: 'string', calc: (table, row) => {
                            const data = getRow(table, row);
                            return `<a target="_blank" href="/api/property/${data.PropertyID}">${data.Address}<br/>${data.City}, ${data.State} ${data.PostalCode}</a>`;
                        }
                    }]
            },
            'containerId': 'table_div'
        }]
    });
    db.draw('loans.json');
    window.db = db;
});

function getRow(view, row) {
    var data = {};
    for (var i = 0; i < view.getNumberOfColumns(); i++)
        data[view.getColumnId(i)] = view.getValue(row, i);
    return data;
}
