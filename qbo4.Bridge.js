(function () {
    'use strict';
    if (!window.qbo4)
        window.qbo4 = {};

    qbo4.error = function (message) { console.log(message); };

    qbo4.get = function (url, options = {}) {
        return qbo4.post(url, {}, Object.assign({ method: 'GET' }, options));
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
