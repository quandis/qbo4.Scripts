(function () {
    'use strict';
    if (!window.qbo4)
        window.qbo4 = {};

    qbo4.error = function (message) { console.log(message); };

    qbo4.get = function (url, options = { method: 'GET' }) {
        return qbo4.post(url, {}, options);
    };

    qbo4.post = function (url, data, options = {}) {
        options = Object.assign({ method: 'POST', accept: 'application/json' }, options);
        return new Promise(function (resolve, reject) {

            if (!options.method)
                qbo4.error("qbo4.get requires that options.method be set.");

            // todo: merge core options with param options with native JS?

            // Do the usual XHR stuff
            var req = new XMLHttpRequest();

            req.open(options.method, url);
            if (options.accept)
                req.setRequestHeader("Accept", options.accept);

            req.onload = function () {
                // This is called even on 404 etc
                // so check the status
                if (req.status < 300) {
                    // Resolve the promise with the response text
                    if (options.accept === "application/json")
                        resolve(JSON.parse(req.response));
                    else
                        resolve(req.response);
                }
                else {
                    // Otherwise reject with the status text
                    // which will hopefully be a meaningful error
                    reject(qbo4.error(req.statusText));
                }
            };

            // Handle network errors
            req.onerror = function () {
                reject(qbo4.error("Network Error"));
            };

            // Make the request
            req.send(data);
        });
    };

    /* @description Creates an array of arrays each with an element for each column.
     * @param data {array} array of arrays with a variable number of elements.
     * @param columns {array} array of property names to populate the result array with.
     * @returns {array} of equally sized arrays.
    */
    qbo4.arrayToTable = function (data, columns) {
        var rows = [];
        data.forEach(item => {
            var row = [];
            columns.forEach(column => {
                row.push(item[column]);
            });
            rows.push(row);
        });
        return rows;
    };

    /* @description Returns the first object property of type {array} found. Useful for finding the array of data from a serialized dataset.
     * @param json {object} object to be converted
     * @returns Returns the first {array} encountered.
    */
    qbo4.getArray = function (json) {
        if (Array.isArray(json)) return json;
        else for (var child in json)
            if (json.hasOwnProperty(child))
                return qbo4.getArray(json[child]);
    };

})();

// This needs to be broken out into qbo4.Visualization.js
(function () {
    'use strict';
    if (!window.qbo4)
        window.qbo4 = {};

    if (!qbo4.visualization)
        qbo4.visualization = {};

    /* @description Dashboard for google visualations, enabing filtering between charts.
     */
    qbo4.visualization.dashboard = class {

        constructor(options) {
            // Establish defaults
            this.options = Object.assign({
                packages: ['table', 'corechart'],
                filters: {},
                charts: []
            }, options);

            this._table = null;
            this._columns = null;

            // Set the current filter from the default filter
            this.filters = this.options.filters;

            // Set up charts, ensuring defaults are set.
            this.charts = [];
            this.options.charts.forEach(chart => { this.addChart(chart); });
        }

        get columns() {
            return this._columns;
        }


        set table(dataTable) {
            this._table = dataTable;
            this._columns = {};
            for (var i = 0; i < dataTable.getNumberOfColumns(); i++)
                this._columns[dataTable.getColumnId(i)] = i;
        }

        get table() {
            return this._table;
        }

        /* @description Add a chart to the list of charts in the dashboard.
         */
        addChart(chart) {
            this.charts.push(Object.assign({
                aggregation: google.visualization.data.count,
                filters: []
            }, chart));
        }

        loadCharts(packages) {
            return new Promise(function (resolve, reject) {
                google.charts.load('current', { 'packages': packages });
                google.charts.setOnLoadCallback(function () { resolve(); });
            });
        }

        getDataTable(url) {
            return qbo4.visualization.getDataTable(url);
        }

        getView(chart) {
            var view = (chart.mapView) ? chart.mapView(this.table) : new google.visualization.DataView(this.table);
            var filters = [];
            chart.filters.forEach(f => {
                if ((f in this.columns) && (f in this.filters))
                    filters.push({ column: view.getColumnIndex(f), value: this.filters[f] });
            });
            if (filters.length > 0)
                view.setRows(view.getFilteredRows(filters));
            return view;
        }

        /* @description Renders each chart in the dashboard based on the datatable
         * @param dataTable {google.visualization.DataTable} to render charts with.
        */
        render() {
            this.charts.forEach(chart => {
                this.renderChart(chart);
            });
        }

        /* @description Draws each chart impacted by changes to the dashboard.filters.
         * @param filter {array} a list of the filters that apply to the chart.
        */
        redraw(filter) {
            var dashboard = this;
            // figure out which charts listen to the filter
            this.charts.filter(chart => {
                return chart.filters && chart.filters.includes(filter);
            }).forEach(chart => {
                // clear out downstream filters.
                if (chart.dimension in dashboard.filters)
                    delete dashboard.filters[chart.dimension];

                this.renderChart(chart);
            });
        }

        renderChart(chart) {
            var dashboard = this;
            // var aggregation = chart.aggregation;
            var dimensionIndex = (chart.dimensionIndex) ? chart.dimensionIndex : dashboard.columns[chart.dimension];
            // var allowedFilters = chart.filters;
            var masterView = dashboard.getView(chart);
            var view = (dimensionIndex)
                ? google.visualization.data.group(masterView, [dimensionIndex], [{ column: 0, aggregation: chart.aggregation, type: 'number' }])
                : masterView;

            var wrapper = new google.visualization.ChartWrapper(Object.assign({ dataTable: view }, chart));
            google.visualization.events.addListener(wrapper, 'select', function () {
                var data = wrapper.getDataTable();
                var selection = wrapper.getChart().getSelection()[0];
                var column = data.getColumnId(0);
                if (selection) {
                    dashboard.filters[column] = data.getValue(selection.row, 0);
                }
                else {
                    // remove filter
                    delete dashboard.filters[column];
                }
                dashboard.redraw(column);
            });
            wrapper.draw();
        }

        async draw(url) {
            await this.loadCharts();
            this.table = await this.getDataTable(url);
            this.render();
        }
    };

    /* @description Infer DataColumn objects from an array of objects. Used to convert a JSON object to a simple array.
     * @param data {object} object to be converted
     * @param scanRows {number} number of rows to scan to infer columns and data types. Default is 10.
     * @returns array of Goggle Visualization DataColumn objects {{ label: string, id: string, type: string}}
    */
    qbo4.visualization.inferColumns = function (data, scanRows = 10) {
        if ((scanRows === 0) || (scanRows > data.length))
            scanRows = data.length;
        for (var r = 0; r < scanRows; r++) {
            var row = data[r];
            var columns = [];
            for (var c in row) {
                if (row.hasOwnProperty(c)) {
                    var isNumber = true;
                    for (var i = 0; i < scanRows; i++) {
                        if (data[i][c] && isNaN(data[i][c])) {
                            isNumber = false;
                            break;
                        }
                    }
                    var column = { label: c, id: c, type: (isNumber) ? 'number' : 'string' };
                    if (!columns.includes(column))
                        columns.push(column);
                }
            }
        }
        return columns;
    };

    /* @description Creates a google visualization DataTable from a serialized DataSet or IDataReader returned by QBO
     * @param url {string} url to fetch data from (e.g. '/api/loan/search')
     * @param options {object} options to pass to qbo4.get(url, options)
     * @returns Promise calling resolve(dataTable)
    */
    qbo4.visualization.getDataTable = function (url, options = {}) {
        return new Promise(function (resolve, reject) {
            qbo4.get(url, options).then(function (json) {
                // Get the first array from a serialized dataset or data reader
                var data = qbo4.getArray(json);
                // Calculate the columns
                var columns = qbo4.visualization.inferColumns(data);
                // Ensure the array is structured like a table
                var rows = qbo4.arrayToTable(data, columns.map(c => c.id));
                // Add the column
                rows.unshift(columns);
                // Create the DataTable
                var dt = google.visualization.arrayToDataTable(rows);
                resolve(dt);
            });
        });
    };

    google.charts.load('current', { 'packages': ['table', 'corechart'] })
        .then(() => { document.dispatchEvent(new Event('qbo4.visualization.ready')); });
    //google.charts.setOnLoadCallback(function () {
    //    document.dispatchEvent(new Event('qbo4.visualization.ready'));
    //});

})();

