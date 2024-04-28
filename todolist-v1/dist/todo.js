"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
var Todo = /*#__PURE__*/function () {
  function Todo(title) {
    _classCallCheck(this, Todo);
    this.title = title;
    this.done = false;
  }
  _createClass(Todo, [{
    key: "toString",
    value: function toString() {
      var marker = this.isDone() ? Todo.DONE_MARKER : Todo.UNDONE_MARKER;
      return "[".concat(marker, "] ").concat(this.title);
    }
  }, {
    key: "markDone",
    value: function markDone() {
      this.done = true;
    }
  }, {
    key: "markUndone",
    value: function markUndone() {
      this.done = false;
    }
  }, {
    key: "isDone",
    value: function isDone() {
      return this.done;
    }
  }, {
    key: "getTitle",
    value: function getTitle() {
      return this.title;
    }
  }]);
  return Todo;
}();
Todo.DONE_MARKER = "X";
Todo.UNDONE_MARKER = " ";
module.exports = Todo;