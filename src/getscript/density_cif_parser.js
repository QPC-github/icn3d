/**
 * @file Density Cif Parser
 * @author David Sehnal dsehnal <alexander.rose@weirdbyte.de>
 * Modified by Jiyao Wang / https://github.com/ncbi/icn3d
 */


iCn3DUI.prototype.DensityCifParser = function(pdbid, type, sigma, emd) { var me = this, ic = me.icn3d; "use strict";
   var url;
   var detail = (me.isMobile() || me.cfg.notebook) ? 0 : 4; //4;

   //https://www.ebi.ac.uk/pdbe/densities/doc.html
   if(type == '2fofc' || type == 'fofc') {
       url = "https://www.ebi.ac.uk/pdbe/densities/x-ray/" + pdbid.toLowerCase() + "/cell?detail=" + detail;
   }
   else if(type == 'em') {
       url = "https://www.ebi.ac.uk/pdbe/densities/emd/" + emd.toLowerCase() + "/cell?detail=" + detail;
   }

   //var bCid = undefined;

    //https://stackoverflow.com/questions/33902299/using-jquery-ajax-to-download-a-binary-file
    if(type == '2fofc' && me.bAjax2fofc) {
        ic.mapData.sigma2 = sigma;
        me.setOption('map', type);
    }
    else if(type == 'fofc' && me.bAjaxfofc) {
        ic.mapData.sigma = sigma;
        me.setOption('map', type);
    }
    else if(type == 'em' && me.bAjaxEm) {
        ic.mapData.sigmaEm = sigma;
        me.setOption('emmap', type);
    }
    else {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", url, true);
        oReq.responseType = "arraybuffer";

        oReq.onreadystatechange = function() {
            if (this.readyState == 4) {
               //me.hideLoading();

               if(this.status == 200) {
                   var arrayBuffer = oReq.response;

                   me.parseChannels(arrayBuffer, type, sigma);

                   if(type == '2fofc' || type == 'fofc') {
                       me.bAjax2fofc = true;
                       me.bAjaxfofc = true;

                       me.setOption('map', type);
                   }
                   else if(type == 'em') {
                       me.bAjaxEm = true;

                       me.setOption('emmap', type);
                   }
                }
                else {
                   if(type == '2fofc' || type == 'fofc') {
                       alert("Density server at EBI has no corresponding electron density map for this structure.");
                   }
                   else if(type == 'em') {
                       alert("Density server at EBI has no corresponding EM density map for this structure.");
                   }
                }

                if(me.deferredEmmap !== undefined) me.deferredEmmap.resolve();
            }
            else {
                me.showLoading();
            }
        };

        oReq.send();
    }
};

iCn3DUI.prototype.parseChannels = function(densitydata, type, sigma) { var me = this, ic = me.icn3d; "use strict";
    var cif = me.BinaryParse(densitydata);

    if(type == '2fofc' || type == 'fofc') {
        var twoDensity = me.getChannel(cif, '2FO-FC');
        var oneDensity = me.getChannel(cif, 'FO-FC');

        // '2fofc'
        var density = twoDensity;
        var sampleCount = density.box.sampleCount;
        var header = {xExtent: sampleCount[0], yExtent: sampleCount[1], zExtent: sampleCount[2], mean: density.valuesInfo.mean, sigma: density.valuesInfo.sigma};
        ic.mapData.header2 = header;

        ic.mapData.data2 = density.data;

        var origin = density.box.origin;
        var dimensions = density.box.dimensions;
        var basis = density.spacegroup.basis;
        var scale = new THREE.Matrix4().makeScale(
            dimensions[0] / (sampleCount[0] ),
            dimensions[1] / (sampleCount[1] ),
            dimensions[2] / (sampleCount[2] ));
        var translate = new THREE.Matrix4().makeTranslation(origin[0], origin[1], origin[2]);
        var fromFrac = new THREE.Matrix4().set(
            basis.x[0], basis.y[0], basis.z[0], 0.0,
            0.0, basis.y[1], basis.z[1], 0.0,
            0.0, 0.0, basis.z[2], 0.0,
            0.0, 0.0, 0.0, 1.0);

        //var toFrac = new LiteMol.Visualization.THREE.Matrix4().getInverse(fromFrac);
        var matrix = fromFrac.multiply(translate).multiply(scale);

        ic.mapData.matrix2 = matrix;

        ic.mapData.type2 = type;
        ic.mapData.sigma2 = sigma;

        // 'fofc'
        density = oneDensity;
        sampleCount = density.box.sampleCount;
        header = {xExtent: sampleCount[0], yExtent: sampleCount[1], zExtent: sampleCount[2], mean: density.valuesInfo.mean, sigma: density.valuesInfo.sigma};
        ic.mapData.header = header;

        ic.mapData.data = density.data;

        origin = density.box.origin;
        dimensions = density.box.dimensions;
        basis = density.spacegroup.basis;
        scale = new THREE.Matrix4().makeScale(
            dimensions[0] / (sampleCount[0] ),
            dimensions[1] / (sampleCount[1] ),
            dimensions[2] / (sampleCount[2] ));
        translate = new THREE.Matrix4().makeTranslation(origin[0], origin[1], origin[2]);
        fromFrac = new THREE.Matrix4().set(
            basis.x[0], basis.y[0], basis.z[0], 0.0,
            0.0, basis.y[1], basis.z[1], 0.0,
            0.0, 0.0, basis.z[2], 0.0,
            0.0, 0.0, 0.0, 1.0);
        //var toFrac = new LiteMol.Visualization.THREE.Matrix4().getInverse(fromFrac);
        matrix = fromFrac.multiply(translate).multiply(scale);
        ic.mapData.matrix = matrix;

        ic.mapData.type = type;
        ic.mapData.sigma = sigma;
    }
    else if(type == 'em') {
        var density = me.getChannel(cif, 'EM');

        var sampleCount = density.box.sampleCount;
        var header = {xExtent: sampleCount[0], yExtent: sampleCount[1], zExtent: sampleCount[2], max: density.valuesInfo.max, min: density.valuesInfo.min};
        ic.mapData.headerEm = header;

        ic.mapData.dataEm = density.data;

        var origin = density.box.origin;
        var dimensions = density.box.dimensions;
        var basis = density.spacegroup.basis;
        var scale = new THREE.Matrix4().makeScale(
            dimensions[0] / (sampleCount[0] ),
            dimensions[1] / (sampleCount[1] ),
            dimensions[2] / (sampleCount[2] ));
        var translate = new THREE.Matrix4().makeTranslation(origin[0], origin[1], origin[2]);
        var fromFrac = new THREE.Matrix4().set(
            basis.x[0], basis.y[0], basis.z[0], 0.0,
            0.0, basis.y[1], basis.z[1], 0.0,
            0.0, 0.0, basis.z[2], 0.0,
            0.0, 0.0, 0.0, 1.0);
        //var toFrac = new LiteMol.Visualization.THREE.Matrix4().getInverse(fromFrac);
        var matrix = fromFrac.multiply(translate).multiply(scale);
        ic.mapData.matrixEm = matrix;

        ic.mapData.typeEm = type;
        ic.mapData.sigmaEm = sigma;
    }
};

iCn3DUI.prototype.getChannel = function(data, name) { var me = this, ic = me.icn3d; "use strict";
    //var block = data.dataBlocks.filter(b => b.header === name)[0];
    //var block = data.dataBlocks.filter(b => b.id === name)[0];

    var jsonData = data.toJSON();

    var block;
    for(var i = 0, il = jsonData.length; i < il; ++i) {
        if(jsonData[i].id == name) block = data.dataBlocks[i];
    }

    var density = me.CIFParse(block);

    return density;
};

iCn3DUI.prototype.CIFParse = function(block) { var me = this, ic = me.icn3d; "use strict";
    var info = block.getCategory('_volume_data_3d_info');

    if (!info) {
        conole.log('_volume_data_3d_info category is missing.');
        return undefined;
    }
    if (!block.getCategory('_volume_data_3d')) {
        conole.log('_volume_data_3d category is missing.');
        return undefined;
    }

    function getVector3(name) {
        var ret = [0, 0, 0];
        for (var i = 0; i < 3; i++) {
            ret[i] = info.getColumn(name + '[' + i + ']').getFloat(0);
        }
        return ret;
    }

    function getNum(name) { return info.getColumn(name).getFloat(0); }

    var header = {
        name: info.getColumn('name').getString(0),
        axisOrder: getVector3('axis_order'),

        origin: getVector3('origin'),
        dimensions: getVector3('dimensions'),

        sampleCount: getVector3('sample_count'),

        spacegroupNumber: getNum('spacegroup_number') | 0,
        cellSize: getVector3('spacegroup_cell_size'),
        cellAngles: getVector3('spacegroup_cell_angles'),

        mean: getNum('mean_sampled'),
        sigma: getNum('sigma_sampled')
    };

    var indices = [0, 0, 0];
    indices[header.axisOrder[0]] = 0;
    indices[header.axisOrder[1]] = 1;
    indices[header.axisOrder[2]] = 2;

    function normalizeOrder(xs) {
        return [xs[indices[0]], xs[indices[1]], xs[indices[2]]];
    }

    function readValues(col, xyzSampleCount, sampleCount, axisIndices) {
        var data = new Float32Array(xyzSampleCount[0] * xyzSampleCount[1] * xyzSampleCount[2]);
        var coord = [0, 0, 0];
        var iX = axisIndices[0], iY = axisIndices[1], iZ = axisIndices[2];
        var mX = sampleCount[0], mY = sampleCount[1], mZ = sampleCount[2];


        var xSize = xyzSampleCount[0];
        var xySize = xyzSampleCount[0] * xyzSampleCount[1];

        var zSize = xyzSampleCount[2];
        var yzSize = xyzSampleCount[1] * xyzSampleCount[2];

        var offset = 0;
        var min = col.getFloat(0), max = min;

        for (var cZ = 0; cZ < mZ; cZ++) {
            coord[2] = cZ;
            for (var cY = 0; cY < mY; cY++) {
                coord[1] = cY;
                for (var cX = 0; cX < mX; cX++) {
                    coord[0] = cX;
                    var v = col.getFloat(offset);
                    offset += 1;
                    //data[coord[iX] + coord[iY] * xSize + coord[iZ] * xySize] = v;
                    data[coord[iZ] + coord[iY] * zSize + coord[iX] * yzSize] = v;
                    if (v < min) min = v;
                    else if (v > max) max = v;
                }
            }
        }

        return { data: data, min: min, max: max };
    }

    function createSpacegroup(number, size, angles) {
        var alpha = (Math.PI / 180.0) * angles[0], beta = (Math.PI / 180.0) * angles[1], gamma = (Math.PI / 180.0) * angles[2];
        var xScale = size[0], yScale = size[1], zScale = size[2];

        var z1 = Math.cos(beta),
              z2 = (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma),
              z3 = Math.sqrt(1.0 - z1 * z1 - z2 * z2);

        var x = [xScale, 0.0, 0.0];
        var y = [Math.cos(gamma) * yScale, Math.sin(gamma) * yScale, 0.0];
        var z = [z1 * zScale, z2 * zScale, z3 * zScale];

        return {
            number: number,
            size: size,
            angles: angles,
            basis: { x: x, y: y, z: z }
        };
    }

    var sampleCount = normalizeOrder(header.sampleCount);

    var rawData = readValues(block.getCategory('_volume_data_3d').getColumn('values'), sampleCount, header.sampleCount, indices);
    //var field = new Field3DZYX(rawData.data, sampleCount);

    var data = {
        name: header.name,
        spacegroup: createSpacegroup(header.spacegroupNumber, header.cellSize, header.cellAngles),
        box: {
            origin: normalizeOrder(header.origin),
            dimensions: normalizeOrder(header.dimensions),
            sampleCount: sampleCount
        },
        //data: field,
        data: rawData.data,
        valuesInfo: { min: rawData.min, max: rawData.max, mean: header.mean, sigma: header.sigma }
    };

    return data;
};

iCn3DUI.prototype.BinaryParse = function(data) { var me = this, ic = me.icn3d; "use strict";
//    var minVersion = [0, 3];
//    try {
        var array = new Uint8Array(data);

        var unpacked = me.MessagePackParse({
                    buffer: array,
                    offset: 0,
                    dataView: new DataView(array.buffer)
        });

        var DataBlock = (function () {
            function DataBlock(data) {
                this.additionalData = {};
                this.header = data.header;
                this.categoryList = data.categories.map(function (c) { return new Category(c); });
                this.categoryMap = new Map();
                for (var _i = 0, _a = this.categoryList; _i < _a.length; _i++) {
                    var c = _a[_i];
                    this.categoryMap.set(c.name, c);
                }
            }
            Object.defineProperty(DataBlock.prototype, "categories", {
                get: function () { return this.categoryList; },
                enumerable: true,
                configurable: true
            });
            DataBlock.prototype.getCategory = function (name) { return this.categoryMap.get(name); };
            DataBlock.prototype.toJSON = function () {
                return {
                    id: this.header,
                    categories: this.categoryList.map(function (c) { return c.toJSON(); }),
                    additionalData: this.additionalData
                };
            };
            return DataBlock;
        }());

        var Category = (function () {
            function Category(data) {
                this.name = data.name;
                this.columnCount = data.columns.length;
                this.rowCount = data.rowCount;
                this.columnNameList = [];
                this.encodedColumns = new Map();
                for (var _i = 0, _a = data.columns; _i < _a.length; _i++) {
                    var c = _a[_i];
                    this.encodedColumns.set(c.name, c);
                    this.columnNameList.push(c.name);
                }
            }
            Object.defineProperty(Category.prototype, "columnNames", {
                get: function () { return this.columnNameList; },
                enumerable: true,
                configurable: true
            });

            var _UndefinedColumn = (function () {
                function _UndefinedColumn() {
                    this.isDefined = false;
                }
                _UndefinedColumn.prototype.getString = function (row) { return null; };
                ;
                _UndefinedColumn.prototype.getInteger = function (row) { return 0; };
                _UndefinedColumn.prototype.getFloat = function (row) { return 0.0; };
                _UndefinedColumn.prototype.getValuePresence = function (row) { return 1 /* NotSpecified */; };
                _UndefinedColumn.prototype.areValuesEqual = function (rowA, rowB) { return true; };
                _UndefinedColumn.prototype.stringEquals = function (row, value) { return value === null; };
                return _UndefinedColumn;
            }());

            Category.prototype.getColumn = function (name) {
                var w = this.encodedColumns.get(name);
                if (w)
                    return wrapColumn(w);
                return _UndefinedColumn;
            };
            Category.prototype.toJSON = function () {
                var _this = this;
                var rows = [];
                var columns = this.columnNameList.map(function (name) { return ({ name: name, column: _this.getColumn(name) }); });
                for (var i = 0; i < this.rowCount; i++) {
                    var item = {};
                    for (var _i = 0, columns_1 = columns; _i < columns_1.length; _i++) {
                        var c = columns_1[_i];
                        var d = c.column.getValuePresence(i);
                        if (d === 0 /* Present */)
                            item[c.name] = c.column.getString(i);
                        else if (d === 1 /* NotSpecified */)
                            item[c.name] = '.';
                        else
                            item[c.name] = '?';
                    }
                    rows[i] = item;
                }
                return { name: this.name, columns: this.columnNames, rows: rows };
            };
            return Category;
        }());

        function getIntArray(type, size) {
            switch (type) {
                case 1 /* Int8 */: return new Int8Array(size);
                case 2 /* Int16 */: return new Int16Array(size);
                case 3 /* Int32 */: return new Int32Array(size);
                case 4 /* Uint8 */: return new Uint8Array(size);
                case 5 /* Uint16 */: return new Uint16Array(size);
                case 6 /* Uint32 */: return new Uint32Array(size);
                default: throw new Error('Unsupported integer data type.');
            }
        }
        function getFloatArray(type, size) {
            switch (type) {
                case 32 /* Float32 */: return new Float32Array(size);
                case 33 /* Float64 */: return new Float64Array(size);
                default: throw new Error('Unsupported floating data type.');
            }
        }
        // http://stackoverflow.com/questions/7869752/javascript-typed-arrays-and-endianness
        var isLittleEndian = (function () {
            var arrayBuffer = new ArrayBuffer(2);
            var uint8Array = new Uint8Array(arrayBuffer);
            var uint16array = new Uint16Array(arrayBuffer);
            uint8Array[0] = 0xAA;
            uint8Array[1] = 0xBB;
            if (uint16array[0] === 0xBBAA)
                return true;
            return false;
        })();
        function int8(data) { return new Int8Array(data.buffer, data.byteOffset); }
        function flipByteOrder(data, bytes) {
            var buffer = new ArrayBuffer(data.length);
            var ret = new Uint8Array(buffer);
            for (var i = 0, n = data.length; i < n; i += bytes) {
                for (var j = 0; j < bytes; j++) {
                    ret[i + bytes - j - 1] = data[i + j];
                }
            }
            return buffer;
        }
        function view(data, byteSize, c) {
            if (isLittleEndian)
                return new c(data.buffer);
            return new c(flipByteOrder(data, byteSize));
        }
        function int16(data) { return view(data, 2, Int16Array); }
        function uint16(data) { return view(data, 2, Uint16Array); }
        function int32(data) { return view(data, 4, Int32Array); }
        function uint32(data) { return view(data, 4, Uint32Array); }
        function float32(data) { return view(data, 4, Float32Array); }
        function float64(data) { return view(data, 8, Float64Array); }
        function fixedPoint(data, encoding) {
            var n = data.length;
            var output = getFloatArray(encoding.srcType, n);
            var f = 1 / encoding.factor;
            for (var i = 0; i < n; i++) {
                output[i] = f * data[i];
            }
            return output;
        }
        function intervalQuantization(data, encoding) {
            var n = data.length;
            var output = getFloatArray(encoding.srcType, n);
            var delta = (encoding.max - encoding.min) / (encoding.numSteps - 1);
            var min = encoding.min;
            for (var i = 0; i < n; i++) {
                output[i] = min + delta * data[i];
            }
            return output;
        }
        function runLength(data, encoding) {
            var output = getIntArray(encoding.srcType, encoding.srcSize);
            var dataOffset = 0;
            for (var i = 0, il = data.length; i < il; i += 2) {
                var value = data[i]; // value to be repeated
                var length_7 = data[i + 1]; // number of repeats
                for (var j = 0; j < length_7; ++j) {
                    output[dataOffset++] = value;
                }
            }
            return output;
        }
        function delta(data, encoding) {
            var n = data.length;
            var output = getIntArray(encoding.srcType, n);
            if (!n)
                return output;
            output[0] = data[0] + (encoding.origin | 0);
            for (var i = 1; i < n; ++i) {
                output[i] = data[i] + output[i - 1];
            }
            return output;
        }
        function integerPackingSigned(data, encoding) {
            var upperLimit = encoding.byteCount === 1 ? 0x7F : 0x7FFF;
            var lowerLimit = -upperLimit - 1;
            var n = data.length;
            var output = new Int32Array(encoding.srcSize);
            var i = 0;
            var j = 0;
            while (i < n) {
                var value = 0, t = data[i];
                while (t === upperLimit || t === lowerLimit) {
                    value += t;
                    i++;
                    t = data[i];
                }
                value += t;
                output[j] = value;
                i++;
                j++;
            }
            return output;
        }
        function integerPackingUnsigned(data, encoding) {
            var upperLimit = encoding.byteCount === 1 ? 0xFF : 0xFFFF;
            var n = data.length;
            var output = new Int32Array(encoding.srcSize);
            var i = 0;
            var j = 0;
            while (i < n) {
                var value = 0, t = data[i];
                while (t === upperLimit) {
                    value += t;
                    i++;
                    t = data[i];
                }
                value += t;
                output[j] = value;
                i++;
                j++;
            }
            return output;
        }
        function integerPacking(data, encoding) {
            return encoding.isUnsigned ? integerPackingUnsigned(data, encoding) : integerPackingSigned(data, encoding);
        }
        function stringArray(data, encoding) {
            var str = encoding.stringData;
            var offsets = decode({ encoding: encoding.offsetEncoding, data: encoding.offsets });
            var indices = decode({ encoding: encoding.dataEncoding, data: data });
            var cache = Object.create(null);
            var result = new Array(indices.length);
            var offset = 0;
            for (var _i = 0, indices_1 = indices; _i < indices_1.length; _i++) {
                var i = indices_1[_i];
                if (i < 0) {
                    result[offset++] = null;
                    continue;
                }
                var v = cache[i];
                if (v === void 0) {
                    v = str.substring(offsets[i], offsets[i + 1]);
                    cache[i] = v;
                }
                result[offset++] = v;
            }
            return result;
        }

        function decodeStep(data, encoding) {
            switch (encoding.kind) {
                case 'ByteArray': {
                    switch (encoding.type) {
                        case 4 /* Uint8 */: return data;
                        case 1 /* Int8 */: return int8(data);
                        case 2 /* Int16 */: return int16(data);
                        case 5 /* Uint16 */: return uint16(data);
                        case 3 /* Int32 */: return int32(data);
                        case 6 /* Uint32 */: return uint32(data);
                        case 32 /* Float32 */: return float32(data);
                        case 33 /* Float64 */: return float64(data);
                        default: throw new Error('Unsupported ByteArray type.');
                    }
                }
                case 'FixedPoint': return fixedPoint(data, encoding);
                case 'IntervalQuantization': return intervalQuantization(data, encoding);
                case 'RunLength': return runLength(data, encoding);
                case 'Delta': return delta(data, encoding);
                case 'IntegerPacking': return integerPacking(data, encoding);
                case 'StringArray': return stringArray(data, encoding);
            }
        }

        function decode(data) {
            var current = data.data;
            for (var i = data.encoding.length - 1; i >= 0; i--) {
                current = decodeStep(current, data.encoding[i]);
            }
            return current;
        }

        function wrapColumn(column) {
            if (!column.data.data)
                return _UndefinedColumn;
            var data = decode(column.data);
            var mask = void 0;
            if (column.mask)
                mask = decode(column.mask);
            if (data.buffer && data.byteLength && data.BYTES_PER_ELEMENT) {
                return mask ? new MaskedNumericColumn(data, mask) : new NumericColumn(data);
            }
            return mask ? new MaskedStringColumn(data, mask) : new StringColumn(data);
        }
        //var fastParseInt = CIFTools.Utils.FastNumberParsers.parseInt;
        function fastParseInt(str, start, end) {
            var ret = 0, neg = 1;
            if (str.charCodeAt(start) === 45 /* - */) {
                neg = -1;
                start++;
            }
            for (; start < end; start++) {
                var c = str.charCodeAt(start) - 48;
                if (c > 9 || c < 0)
                    return (neg * ret) | 0;
                else
                    ret = (10 * ret + c) | 0;
            }
            return neg * ret;
        }
        //var fastParseFloat = CIFTools.Utils.FastNumberParsers.parseFloat;
        function fastParseFloat(str, start, end) {
            var neg = 1.0, ret = 0.0, point = 0.0, div = 1.0;
            if (str.charCodeAt(start) === 45) {
                neg = -1.0;
                ++start;
            }
            while (start < end) {
                var c = str.charCodeAt(start) - 48;
                if (c >= 0 && c < 10) {
                    ret = ret * 10 + c;
                    ++start;
                }
                else if (c === -2) {
                    ++start;
                    while (start < end) {
                        c = str.charCodeAt(start) - 48;
                        if (c >= 0 && c < 10) {
                            point = 10.0 * point + c;
                            div = 10.0 * div;
                            ++start;
                        }
                        else if (c === 53 || c === 21) {
                            return parseScientific(neg * (ret + point / div), str, start + 1, end);
                        }
                        else {
                            return neg * (ret + point / div);
                        }
                    }
                    return neg * (ret + point / div);
                }
                else if (c === 53 || c === 21) {
                    return parseScientific(neg * ret, str, start + 1, end);
                }
                else
                    break;
            }
            return neg * ret;
        }

        var NumericColumn = (function () {
            function NumericColumn(data) {
                this.data = data;
                this.isDefined = true;
            }
            NumericColumn.prototype.getString = function (row) { return "" + this.data[row]; };
            NumericColumn.prototype.getInteger = function (row) { return this.data[row] | 0; };
            NumericColumn.prototype.getFloat = function (row) { return 1.0 * this.data[row]; };
            NumericColumn.prototype.stringEquals = function (row, value) { return this.data[row] === fastParseFloat(value, 0, value.length); };
            NumericColumn.prototype.areValuesEqual = function (rowA, rowB) { return this.data[rowA] === this.data[rowB]; };
            NumericColumn.prototype.getValuePresence = function (row) { return 0 /* Present */; };
            return NumericColumn;
        }());
        var MaskedNumericColumn = (function () {
            function MaskedNumericColumn(data, mask) {
                this.data = data;
                this.mask = mask;
                this.isDefined = true;
            }
            MaskedNumericColumn.prototype.getString = function (row) { return this.mask[row] === 0 /* Present */ ? "" + this.data[row] : null; };
            MaskedNumericColumn.prototype.getInteger = function (row) { return this.mask[row] === 0 /* Present */ ? this.data[row] : 0; };
            MaskedNumericColumn.prototype.getFloat = function (row) { return this.mask[row] === 0 /* Present */ ? this.data[row] : 0; };
            MaskedNumericColumn.prototype.stringEquals = function (row, value) { return this.mask[row] === 0 /* Present */ ? this.data[row] === fastParseFloat(value, 0, value.length) : value === null || value === void 0; };
            MaskedNumericColumn.prototype.areValuesEqual = function (rowA, rowB) { return this.data[rowA] === this.data[rowB]; };
            MaskedNumericColumn.prototype.getValuePresence = function (row) { return this.mask[row]; };
            return MaskedNumericColumn;
        }());
        var StringColumn = (function () {
            function StringColumn(data) {
                this.data = data;
                this.isDefined = true;
            }
            StringColumn.prototype.getString = function (row) { return this.data[row]; };
            StringColumn.prototype.getInteger = function (row) { var v = this.data[row]; return fastParseInt(v, 0, v.length); };
            StringColumn.prototype.getFloat = function (row) { var v = this.data[row]; return fastParseFloat(v, 0, v.length); };
            StringColumn.prototype.stringEquals = function (row, value) { return this.data[row] === value; };
            StringColumn.prototype.areValuesEqual = function (rowA, rowB) { return this.data[rowA] === this.data[rowB]; };
            StringColumn.prototype.getValuePresence = function (row) { return 0 /* Present */; };
            return StringColumn;
        }());
        var MaskedStringColumn = (function () {
            function MaskedStringColumn(data, mask) {
                this.data = data;
                this.mask = mask;
                this.isDefined = true;
            }
            MaskedStringColumn.prototype.getString = function (row) { return this.mask[row] === 0 /* Present */ ? this.data[row] : null; };
            MaskedStringColumn.prototype.getInteger = function (row) { if (this.mask[row] !== 0 /* Present */)
                return 0; var v = this.data[row]; return fastParseInt(v || '', 0, (v || '').length); };
            MaskedStringColumn.prototype.getFloat = function (row) { if (this.mask[row] !== 0 /* Present */)
                return 0; var v = this.data[row]; return fastParseFloat(v || '', 0, (v || '').length); };
            MaskedStringColumn.prototype.stringEquals = function (row, value) { return this.data[row] === value; };
            MaskedStringColumn.prototype.areValuesEqual = function (rowA, rowB) { return this.data[rowA] === this.data[rowB]; };
            MaskedStringColumn.prototype.getValuePresence = function (row) { return this.mask[row]; };
            return MaskedStringColumn;
        }());

        var File = (function () {
                    function File(data) {
                        this.dataBlocks = data.dataBlocks.map(function (b) { return new DataBlock(b); });
                    }
                    File.prototype.toJSON = function () {
                        return this.dataBlocks.map(function (b) { return b.toJSON(); });
                    };
                    return File;
        }());

        var file = new File(unpacked);
        return file;

//    }
//    catch (e) {
//        return CIFTools.ParserResult.error('' + e);
//    }
};

iCn3DUI.prototype.MessagePackParse = function(state) { var me = this, ic = me.icn3d; "use strict";
    /*
     * Adapted from https://github.com/rcsb/mmtf-javascript
     * by Alexander Rose <alexander.rose@weirdbyte.de>, MIT License, Copyright (c) 2016
     */
    /**
     * decode all key-value pairs of a map into an object
     * @param  {Integer} length - number of key-value pairs
     * @return {Object} decoded map
     */
    function map(state, length) {
        var value = {};
        for (var i = 0; i < length; i++) {
            var key = me.MessagePackParse(state);
            value[key] = me.MessagePackParse(state);
        }
        return value;
    }
    /**
     * decode binary array
     * @param  {Integer} length - number of elements in the array
     * @return {Uint8Array} decoded array
     */
    function bin(state, length) {
        // This approach to binary parsing wastes a bit of memory to trade for speed compared to:
        //
        //   var value = buffer.subarray(offset, offset + length); //new Uint8Array(buffer.buffer, offset, length);
        //
        // It turns out that using the view created by subarray probably uses DataView
        // in the background, which causes the element access to be several times slower
        // than creating the new byte array.
        var value = new Uint8Array(length);
        var o = state.offset;
        for (var i = 0; i < length; i++)
            value[i] = state.buffer[i + o];
        state.offset += length;
        return value;
    }
    /**
         * decode array
         * @param  {Integer} length - number of array elements
         * @return {Array} decoded array
         */
    function array(state, length) {
        var value = new Array(length);
        for (var i = 0; i < length; i++) {
            value[i] = me.MessagePackParse(state);
        }
        return value;
    }

    /**
     * decode string
     * @param  {Integer} length - number string characters
     * @return {String} decoded string
     */
    function str(state, length) {
        var value = utf8Read(state.buffer, state.offset, length);
        state.offset += length;
        return value;
    }

    var __chars = function () {
        var data = [];
        for (var i = 0; i < 1024; i++)
            data[i] = String.fromCharCode(i);
        return data;
    }();

    function utf8Read(data, offset, length) {
        var chars = __chars;
        var str = void 0, chunk = [], chunkSize = 512, chunkOffset = 0;
        for (var i = offset, end = offset + length; i < end; i++) {
            var byte = data[i];
            // One byte character
            if ((byte & 0x80) === 0x00) {
                chunk[chunkOffset++] = chars[byte];
            }
            else if ((byte & 0xe0) === 0xc0) {
                chunk[chunkOffset++] = chars[((byte & 0x0f) << 6) | (data[++i] & 0x3f)];
            }
            else if ((byte & 0xf0) === 0xe0) {
                chunk[chunkOffset++] = String.fromCharCode(((byte & 0x0f) << 12) |
                    ((data[++i] & 0x3f) << 6) |
                    ((data[++i] & 0x3f) << 0));
            }
            else if ((byte & 0xf8) === 0xf0) {
                chunk[chunkOffset++] = String.fromCharCode(((byte & 0x07) << 18) |
                    ((data[++i] & 0x3f) << 12) |
                    ((data[++i] & 0x3f) << 6) |
                    ((data[++i] & 0x3f) << 0));
            }
            else
                throwError("Invalid byte " + byte.toString(16));
            if (chunkOffset === chunkSize) {
                str = str || [];
                str[str.length] = chunk.join('');
                chunkOffset = 0;
            }
        }
        if (!str)
            return chunk.slice(0, chunkOffset).join('');
        if (chunkOffset > 0) {
            str[str.length] = chunk.slice(0, chunkOffset).join('');
        }
        return str.join('');
    }

    var type = state.buffer[state.offset];

    var value, length;
    // Positive FixInt
    if ((type & 0x80) === 0x00) {
        state.offset++;
        return type;
    }
    // FixMap
    if ((type & 0xf0) === 0x80) {
        length = type & 0x0f;
        state.offset++;
        return map(state, length);
    }
    // FixArray
    if ((type & 0xf0) === 0x90) {
        length = type & 0x0f;
        state.offset++;
        return array(state, length);
    }
    // FixStr
    if ((type & 0xe0) === 0xa0) {
        length = type & 0x1f;
        state.offset++;
        return str(state, length);
    }
    // Negative FixInt
    if ((type & 0xe0) === 0xe0) {
        value = state.dataView.getInt8(state.offset);
        state.offset++;
        return value;
    }
    switch (type) {
        // nil
        case 0xc0:
            state.offset++;
            return null;
        // false
        case 0xc2:
            state.offset++;
            return false;
        // true
        case 0xc3:
            state.offset++;
            return true;
        // bin 8
        case 0xc4:
            length = state.dataView.getUint8(state.offset + 1);
            state.offset += 2;
            return bin(state, length);
        // bin 16
        case 0xc5:
            length = state.dataView.getUint16(state.offset + 1);
            state.offset += 3;
            return bin(state, length);
        // bin 32
        case 0xc6:
            length = state.dataView.getUint32(state.offset + 1);
            state.offset += 5;
            return bin(state, length);
        // float 32
        case 0xca:
            value = state.dataView.getFloat32(state.offset + 1);
            state.offset += 5;
            return value;
        // float 64
        case 0xcb:
            value = state.dataView.getFloat64(state.offset + 1);
            state.offset += 9;
            return value;
        // uint8
        case 0xcc:
            value = state.buffer[state.offset + 1];
            state.offset += 2;
            return value;
        // uint 16
        case 0xcd:
            value = state.dataView.getUint16(state.offset + 1);
            state.offset += 3;
            return value;
        // uint 32
        case 0xce:
            value = state.dataView.getUint32(state.offset + 1);
            state.offset += 5;
            return value;
        // int 8
        case 0xd0:
            value = state.dataView.getInt8(state.offset + 1);
            state.offset += 2;
            return value;
        // int 16
        case 0xd1:
            value = state.dataView.getInt16(state.offset + 1);
            state.offset += 3;
            return value;
        // int 32
        case 0xd2:
            value = state.dataView.getInt32(state.offset + 1);
            state.offset += 5;
            return value;
        // str 8
        case 0xd9:
            length = state.dataView.getUint8(state.offset + 1);
            state.offset += 2;
            return str(state, length);
        // str 16
        case 0xda:
            length = state.dataView.getUint16(state.offset + 1);
            state.offset += 3;
            return str(state, length);
        // str 32
        case 0xdb:
            length = state.dataView.getUint32(state.offset + 1);
            state.offset += 5;
            return str(state, length);
        // array 16
        case 0xdc:
            length = state.dataView.getUint16(state.offset + 1);
            state.offset += 3;
            return array(state, length);
        // array 32
        case 0xdd:
            length = state.dataView.getUint32(state.offset + 1);
            state.offset += 5;
            return array(state, length);
        // map 16:
        case 0xde:
            length = state.dataView.getUint16(state.offset + 1);
            state.offset += 3;
            return map(state, length);
        // map 32
        case 0xdf:
            length = state.dataView.getUint32(state.offset + 1);
            state.offset += 5;
            return map(state, length);
    }
};
