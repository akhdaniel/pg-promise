'use strict';

// NOTE: This file is a work-in-progress!

var $npm = {
    utils: require('./utils'),
    formatting: require('./formatting')
};

var fmModifiers = [
    '^',        // Raw-Text variable
    ':raw',     // Raw-Text variable
    '~',        // SQL Name/Identifier
    ':name',    // SQL Name/Identifier
    '#',        // Escaped value
    ':value',   // Escaped value
    ':json',    // JSON modifier
    ':csv'      // CSV modifier
];

function checkModifier(mod, pos) {
    if (mod && fmModifiers.indexOf(mod) === -1) {
        throw new TypeError("Invalid formatting modifier '" + mod + "' at index " + pos + ".");
    }
}

function getColumn(name, pos) {
    var mod = name.match(/\^|~|#|:raw|:name|:json|:csv|:value/);
    var res = {
        name: name.substr(0, mod.index),
        mod: mod ? mod[0] : null
    };
    checkModifier(res.mod, pos);
    return res;
}

function ColumnError(msg, index) {

}

// this will cache all the column details nicely! :)
// obj is optional;
// it is to be available via export
function Columns(cols, obj) {
    if (!(this instanceof Columns)) {
        return new Columns(cols, obj);
    }
    this.data = [];
    var all = false;
    if (cols === 'all') {
        all = true;
        cols = null;
    }

    if ($npm.utils.isNull(cols)) {
        if (!obj || typeof obj !== 'object') {
            throw new TypeError("The object must be specified when columns aren't.");
        }
        for (var name in obj) {
            if (all || obj.hasOwnProperty(name)) {
                this.data.push({
                    name: name
                });
            }
        }
    } else {
        if (Array.isArray(cols) && cols.length) {
            this.data = cols.map(function (c, index) {
                if (typeof c === 'string') {
                    return getColumn(c);
                }
                if (c && typeof c === 'object') {
                    parseColInfo(c, index);
                    return c;
                }
                throw new TypeError("Unrecognized column");
            });
        } else {
            if (!all) {
                throw new TypeError("Invalid 'columns' parameter.");
            }
        }
    }

    function parseColInfo(col, index) {
        // TODO: Will need to report the index also.
        if (!('name' in col)) {
            throw new TypeError("Property 'name' is required.");
        }
        if (typeof col.name !== 'string' && typeof col.name !== 'number') {
            throw new TypeError("Invalid property 'name'.");
        }
        if (col.mod && fmModifiers.indexOf(col.mod) === -1) {
            throw new TypeError("Invalid property 'mod'.");
        }


    }

    /*
     // IDEA:
     var columns = [{
     name: 'bla', // can be text or number;
     mod: '^', // must exist;
     cast: '::date', // must be a text string;
     def: 123,
     init: function (value) { // must be a function

     }
     }, {
     /// etc...
     }];
     */

}


// possible values:
// 'all' - includes the inherited;
// ['col1:csv', 'col2^',...] - this supports modifiers;
//
// can also do the combination: ['name:csv', {name:'hello'}, 'last']

// List of columns is optional for insert and update, but it is required
// for inserts, and possible updates;
function getColumns(obj, columns) {

}

function getOptions(options) {
    var res = {};
    if (options) {
        if (options.defaults && typeof options.defaults === 'object') {
            res.defaults = options.defaults;
        }
        res.inherit = !!options.inherit;
        if (typeof options.include === 'string') {
            res.include = [options.include];
        } else {
            if (Array.isArray(options.include)) {
                res.include = options.include.filter(function (inc) {
                    return typeof inc === 'string';
                });
            }
        }
        if (typeof options.exclude === 'string') {
            res.exclude = [options.exclude];
            checkIncluded(options.exclude);
        } else {
            if (Array.isArray(options.exclude)) {
                res.exclude = options.exclude.filter(function (exc) {
                    if (typeof exc === 'string') {
                        checkIncluded(exc);
                        return true;
                    }
                });
            }
        }
    }

    function checkIncluded(propName) {
        if (res.include && res.include.indexOf(propName) !== -1) {
            throw new TypeError("Property '" + propName + "' is included and excluded at the same time.");
        }
    }

    return res;
}

function getData(obj, opt) {
    var names = [], values = [];
    for (var prop in obj) {
        if ((opt.inherit || obj.hasOwnProperty(prop)) && (!opt.include || opt.include.indexOf(prop) !== -1) && (!opt.exclude || opt.exclude.indexOf(prop) === -1)) {
            names.push(prop);
            values.push(obj[prop]);
        }
    }

    if (opt.defaults) {
        for (var prop in opt.defaults) {
            if (opt.exclude && opt.exclude.indexOf(prop) !== -1) {
                throw new TypeError("Cannot exclude property '" + prop + "', as it has a default value.");
            }
            var idx = names.indexOf(prop), val = opt.defaults[prop];
            if (typeof val === 'function') {
                if (idx === -1) {
                    names.push(prop);
                    values.push(val.call(obj));
                } else {
                    values[idx] = val.call(obj, values[idx]);
                }
            } else {
                if (idx === -1) {
                    names.push(prop);
                    values.push(val);
                }
            }
        }
    }

    return {
        names: names,
        values: values
    };
}

/* istanbul ignore next */
/**
 * @method helpers.insert
 * @description
 * Generates a complete `INSERT` query from an object, using its properties as insert values.
 *
 * @param {String} table
 * Destination table name.
 *
 * Passing in anything other than a non-empty string will throw {@link external:TypeError TypeError} =
 * `Parameter 'table' must be a non-empty text string.`
 *
 * @param {Object} obj
 * Object with properties for insert values.
 *
 * Passing in anything other than a non-null object will throw {@link external:TypeError TypeError} =
 * `Parameter 'obj' must be a non-null object.`
 *
 * @param {helpers.propertyOptions} [options]
 * An object with optional parameters.
 *
 * Passing in anything other than a non-null object will be ignored.
 *
 * @returns {string}
 * The resulting query string.
 *
 * @example
 *
 * // Default usage
 *
 * var obj = {
 *    one: 123,
 *    two: 'test'
 * };
 *
 * var query = pgp.helpers.insert('myTable', obj);
 * //=> INSERT INTO "myTable"("one","two") VALUES(123,'test')
 *
 * @example
 *
 * // Advanced usage, with `exclude` and `defaults`
 *
 * var obj = {
 *     zero: 0,
 *     one: 1,
 *     two: undefined,
 *     // `three` is missing
 *     four: true
 * };
 *
 * var query = pgp.helpers.insert('myTable', obj, {
 *     exclude: 'zero', // exclude property `zero`
 *     defaults: {
 *         one: 123, // use `one` = 123, if missing;
 *         three: 555, // use `three` = 555, if missing;
 *         two: function (value) {
 *             // set `two` = `second`, if it is `undefined`,
 *             // or else keep the current value:
 *             return value === undefined ? 'second' : value;
 *         },
 *         four: function (value) {
 *             // if `one` is equal 1, set `four` to `false`,
 *             // or else keep the current value:
 *             return this.one === 1 ? false : value;
 *         }
 *     }
 * });
 * //=> INSERT INTO "myTable"("one","two","four","three") VALUES(1,'second',false,555)
 *
 */
function insert(table, obj, options, capSQL) {
    if (!$npm.utils.isText(table)) {
        throw new TypeError("Parameter 'table' must be a non-empty text string.");
    }
    if (!obj || typeof obj !== 'object') {
        throw new TypeError("Parameter 'obj' must be a non-null object.");
    }

    var opt = getOptions(options);
    var data = getData(obj, opt);

    var query = "insert into $1~($2^) values($3^)";
    if (capSQL) {
        query = query.toUpperCase();
    }

    var names = data.names.map(function (n) {
        return $npm.formatting.as.name(n);
    }).join(',');

    return $npm.formatting.as.format(query, [table, names, $npm.formatting.as.csv(data.values)]);
}

/* istanbul ignore next */
/**
 * @method helpers.inserts
 * @param table
 * @param arr
 * @param {helpers.propertyOptions} [options]
 *
 * @param capSQL
 */
function inserts(table, arr, options, capSQL) {

    if (!$npm.utils.isText(table)) {
        throw new TypeError("Parameter 'table' must be a non-empty text string.");
    }

    if (!Array.isArray(arr)) {
        throw new TypeError("Parameter 'arr' must be an array.");
    }

    // how to make this work...
    // it does need include/exclude/defaults/inherit;

    // - for each object in the array do the following:
    //   marry its properties with the defaults;

    // PROBLEMS:
    // 1. template for the column list (We don't know the right column set for multi-INSERT).
    // 2. formatting syntax, like ^, :csv, :json, etc - needs to be passed in!

    // BIG ONE: Problem 2 is applicable to all methods!
    // SCRAP: It is all no good, we need a template for all methods!
    // This also means that: Include/Exclude/Inherit are not needed, only Defaults
    // is needed. BUT, since we do not have a list of column names directly, what
    // good is the Defaults?

    // Gets more awkward for an UPDATE, as we need both names and the modifiers,
    // while the template concept isn't useful....unless, we pull names from the template.

    // Try this idea for everything:
    var template1 = ['one', 'two:json', 'three:csv', 'four^'];
    var template2 = ['1', '2:json', '3:csv', '4^']; // this looks bad :(

    // How about:
    var template3 = '${one}, ${two^}'; // what good is it for an update?
    // plus, you need to be able to set only properties that have changed!

    // Looks like I'm gonna have to separate the options object into two:
    // 1. insertOptions:

    // 2. updateOptions. By default, just update all properties. Need support for:
    // include/exclude/defaults

    // MORE PROBLEMS: SQL value modifiers: ::array, ::date, etc... they come with actual values!

    // IDEA:
    var columns = [{
        name: 'bla',
        mod: '^',
        cast: '::date',
        def: 123,
        init: function (value) {

        }
    }, {
        /// etc...
    }];

    // with optional:
    var columns = ['bla'];
    // no need for include/exclude/inherit, only for 'defaults'
    // COOL:
    //updateOrInsert(table, data, options = {columns, defaults, inherit});
    // inherit and defaults will only be used when 'columns' isn't specified.

    // BETTER approach, with columns support many values:
    // '*', 'all', [list of columns], [{}, {}] column configs;

    var opt = getOptions(options);

    var queries = arr.map(function (obj) {
        var data = getData(obj, opt);

        var q = "insert into $1~($2^) values($3^)";
        if (capSQL) {
            q = q.toUpperCase();
        }

        var names = data.names.map(function (n) {
            return $npm.formatting.as.name(n);
        }).join(',');

        return $npm.formatting.as.format(query, [table, names, $npm.formatting.as.csv(data.values)]);
    });

}

/* istanbul ignore next */
/**
 * @method helpers.update
 * @description
 * Generates a complete `UPDATE` query from an object, using its properties as update values.
 *
 * @param {String} table
 * Name of the table to be updated.
 *
 * Passing in anything other than a non-empty string will throw {@link external:TypeError TypeError} =
 * `Parameter 'table' must be a non-empty text string.`
 *
 * @param {Object} obj
 * Object with properties for update values.
 *
 * Passing in anything other than a non-null object will throw {@link external:TypeError TypeError} =
 * `Parameter 'obj' must be a non-null object.`
 *
 * @param {helpers.propertyOptions} [options]
 * An object with optional parameters.
 *
 * Passing in anything other than a non-null object will be ignored.
 *
 * @returns {string}
 * The resulting query string.
 */
function update(table, obj, options, capSQL) {
    if (!$npm.utils.isText(table)) {
        throw new TypeError("Parameter 'table' must be a non-empty text string.");
    }
    if (!obj || typeof obj !== 'object') {
        throw new TypeError("Parameter 'obj' must be a non-null object.");
    }

    var opt = getOptions(options);
    var data = getData(obj, opt);

    if (!data.names.length) {
        throw new TypeError("Cannot generate a valid UPDATE without any fields.");
    }

    var query = "update $1~ set ";
    if (capSQL) {
        query = query.toUpperCase();
    }
    query = $npm.formatting.as.format(query, table);
    var names = data.names.map(function (name, index) {
        return $npm.formatting.as.name(name) + "=$" + (index + 1);
    });
    return $npm.formatting.as.format(query + names.join(','), data.values);
}

/* istanbul ignore next */
/**
 * @namespace helpers
 * @private
 * @description
 * **NOTE: Due to be introduced with `pg-promise` v.4.1.0, it is currently under development.**
 *
 * Namespace for all query-formatting helper functions, available as `pgp.helpers` after initializing the library.
 */
module.exports = function (config) {
    return {
        insert: function (table, obj, options) {
            var capSQL = config.options && config.options.capSQL;
            return insert(table, obj, options, capSQL);
        },
        update: function (table, obj, options) {
            var capSQL = config.options && config.options.capSQL;
            return update(table, obj, options, capSQL);
        }
    };
};

/**
 * @callback helpers.propertyTest
 * @description
 * Used by options `include` and `exclude` to test properties for inclusion/exclusion,
 * based on the property's name and value, plus the state of the object being formatted.
 *
 * The function is always called with `this` context set to the object being formatted.
 *
 * @property {string} name
 * Name of the property being tested.
 *
 * @property {} value
 * Value of the property being tested.
 *
 * @returns {Boolean}
 * - `true` - the test has passed
 * - `false` - the test has failed
 */

/**
 * @typedef helpers.propertyOptions
 * @description
 * Set of rules used when formatting queries.
 *
 * @property {String|Array|Function} [include]
 * Custom way of determining which properties to include:
 * - a text string with just one property name to be included;
 * - an array of strings - names of the properties to be included;
 * - a function - {@link helpers.propertyTest propertyTest} callback to test if the property should be included.
 *
 * By default, all available properties are used. Setting `include` to a string, array of function will trigger
 * the use of only the properties as determined by the option.
 *
 * @property {String|Array} [exclude]
 * Either a single string or an array of strings - names of properties to be excluded.
 *
 * Excluding a property name that's present on the `include` list will throw {@link external:TypeError TypeError} =
 * `Property 'propName' is included and excluded at the same time.`
 *
 * Excluding a property name that's present within the `defaults` option will throw {@link external:TypeError TypeError} =
 * `Cannot exclude property 'propName', as it has a default value.`
 *
 * @property {Object} [defaults]
 * An object with required properties set to their default values. Such values will be used whenever the corresponding property
 * doesn't exist within `obj`.
 *
 * Setting a property to a function is treated as an override for the value, and the call into `defaults.propName(value)` is expected
 * to return the new value for the property. The function is called with parameter `value` - the original value within `obj`, and with
 * `this` context set to `obj`, i.e. `value` = `this.propName`.
 *
 * @property {Boolean} [inherit=false]
 * Triggers the use of inherited properties within `obj` (in addition to its own).
 *
 * By default, only the object's own properties are enumerated for insert values.
 *
 */