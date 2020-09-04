"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime/helpers/assertThisInitialized"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _stream = _interopRequireDefault(require("stream"));

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = (0, _getPrototypeOf2["default"])(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = (0, _getPrototypeOf2["default"])(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return (0, _possibleConstructorReturn2["default"])(this, result); }; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

var Transform = _stream["default"].Transform;
/**
 * Escapes dots in the beginning of lines. Ends the stream with <CR><LF>.<CR><LF>
 * Also makes sure that only <CR><LF> sequences are used for linebreaks
 *
 * @param {Object} options Stream options
 */

var DataStream = /*#__PURE__*/function (_Transform) {
  (0, _inherits2["default"])(DataStream, _Transform);

  var _super = _createSuper(DataStream);

  function DataStream(options) {
    var _this;

    (0, _classCallCheck2["default"])(this, DataStream);
    _this = _super.call(this, options); // init Transform

    (0, _defineProperty2["default"])((0, _assertThisInitialized2["default"])(_this), "options", {});
    (0, _defineProperty2["default"])((0, _assertThisInitialized2["default"])(_this), "_curLine", void 0);
    (0, _defineProperty2["default"])((0, _assertThisInitialized2["default"])(_this), "inByteCount", void 0);
    (0, _defineProperty2["default"])((0, _assertThisInitialized2["default"])(_this), "outByteCount", void 0);
    (0, _defineProperty2["default"])((0, _assertThisInitialized2["default"])(_this), "lastByte", void 0);
    _this.options = options || {};
    _this._curLine = '';
    _this.inByteCount = 0;
    _this.outByteCount = 0;
    _this.lastByte = false;
    return _this;
  }
  /**
   * Escapes dots
   */


  (0, _createClass2["default"])(DataStream, [{
    key: "_transform",
    value: function _transform(chunk, encoding, done) {
      var chunks = [];
      var chunklen = 0;
      var i,
          len,
          lastPos = 0;
      var buf;

      if (!chunk || !chunk.length) {
        return done();
      }

      if (typeof chunk === 'string') {
        chunk = Buffer.from(chunk);
      }

      this.inByteCount += chunk.length;

      for (i = 0, len = chunk.length; i < len; i++) {
        if (chunk[i] === 0x2e) {
          // .
          if (i && chunk[i - 1] === 0x0a || !i && (!this.lastByte || this.lastByte === 0x0a)) {
            buf = chunk.slice(lastPos, i + 1);
            chunks.push(buf);
            chunks.push(Buffer.from('.'));
            chunklen += buf.length + 1;
            lastPos = i + 1;
          }
        } else if (chunk[i] === 0x0a) {
          // .
          if (i && chunk[i - 1] !== 0x0d || !i && this.lastByte !== 0x0d) {
            if (i > lastPos) {
              buf = chunk.slice(lastPos, i);
              chunks.push(buf);
              chunklen += buf.length + 2;
            } else {
              chunklen += 2;
            }

            chunks.push(Buffer.from('\r\n'));
            lastPos = i + 1;
          }
        }
      }

      if (chunklen) {
        // add last piece
        if (lastPos < chunk.length) {
          buf = chunk.slice(lastPos);
          chunks.push(buf);
          chunklen += buf.length;
        }

        this.outByteCount += chunklen;
        this.push(Buffer.concat(chunks, chunklen));
      } else {
        this.outByteCount += chunk.length;
        this.push(chunk);
      }

      this.lastByte = chunk[chunk.length - 1];
      done();
    }
    /**
     * Finalizes the stream with a dot on a single line
     */

  }, {
    key: "_flush",
    value: function _flush(done) {
      var buf;

      if (this.lastByte === 0x0a) {
        buf = Buffer.from('.\r\n');
      } else if (this.lastByte === 0x0d) {
        buf = Buffer.from('\n.\r\n');
      } else {
        buf = Buffer.from('\r\n.\r\n');
      }

      this.outByteCount += buf.length;
      this.push(buf);
      done();
    }
  }]);
  return DataStream;
}(Transform);

var _default = DataStream;
exports["default"] = _default;