const { dbQuery } = require("./db-query");
const bcrypt = require("bcrypt");

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }
  
  // authenticate username and password of user
  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = "SELECT password FROM users" +
    " WHERE username = $1";

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // Mark all todos on the todo list as done. Returns `true` on success,
  // `false` if the todo list doesn't exist. The todo list ID must be numeric.
  async completeAllTodos(todoListId) {
    const COMPLETE_TODOS = `
    UPDATE todos
    SET done = true
    WHERE todolist_id = $1 AND done = false AND username = $2;
    `;

    let result = await dbQuery(COMPLETE_TODOS, todoListId, this.username);
    return result.rowCount > 0;
  }

  // Create a new todo with the specified title and add it to the indicated todo
  // list. Returns `true` on success, `false` on failure.
  async createTodo(todoListId, todoTitle) {
    const CREATE_TODO = `
    INSERT INTO todos (todolist_id, title, username)
    VALUES ($1, $2, $3)
    `;

    let todoList = await this.loadTodoList(+todoListId);
    if (!todoList) throw new Error("Not found.");

    let result = await dbQuery(CREATE_TODO, todoListId, todoTitle, this.username);
    return result.rowCount > 0;
  }

  // Create a new todo list with the specified title and add it to the list of
  // todo lists. Returns `true` on success, `false` on failure. (At this time,
  // there are no known failure conditions.)
  async createTodoList(todoListTitle) {
    const CREATE_LIST = `
    INSERT INTO todolists (title, username)
    VALUES ($1, $2)
    `;
    
    try {
      let result = await dbQuery(CREATE_LIST, todoListTitle, this.username);
      return result.rowCount > 0;
    } catch (err) {
      if (this.isUniqueConstraintViolation(err)) {
        return false;
      } else {
        throw err;
      }
    }
  }

  // Delete the specified todo from the specified todo list. Returns `true` on
  // success, `false` if the todo or todo list doesn't exist. The id arguments
  // must both be numeric.
  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = `
    DELETE FROM todos
    WHERE todolist_id = $1 AND id = $2 AND username = $3
    `;

    let deleteResult = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return deleteResult.rowCount > 0;
  }

  // Delete a todo list from the list of todo lists. Returns `true` on success,
  // `false` if the todo list doesn't exist. The ID argument must be numeric.
  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = `
    DELETE FROM todolists
    WHERE id = $1 AND username = $2
    `;

    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }

  // Returns `true` if a todo list with the specified title exists in the list
  // of todo lists, `false` otherwise.
  async existsTodoListTitle(title) {
    const SELECT_TODOLIST = `
    SELECT * FROM todolists
    WHERE title = $1 AND username = $2
    `;

    let result = await dbQuery(SELECT_TODOLIST, title, this.username);
    return result.rowCount > 0;
  }

  // Does the todo list have any undone todos? Returns true if yes, false if no.
  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }
  
  // Are all of the todos in the todo list done? If the todo list has at least
  // one todo and all of its todos are marked as done, then the todo list is
  // done. Otherwise, it is undone.
  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  // Find a todo with the indicated ID in the indicated todo list. Returns
  // `undefined` if not found. Note that both `todoListId` and `todoId` must be
  // numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = `
    SELECT * FROM todos 
    WHERE todolist_id = $1 AND id = $2 AND username = $3
    `;

    let result = await dbQuery(FIND_TODO, todoListId, todoId, this.username);
    return result.rows[0];
  };


  // Find a todo list with the indicated ID. Returns `undefined` if not found.
  // Note that `todoListId` must be numeric.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = "SELECT * FROM todolists WHERE id = $1 AND username = $2";
    const FIND_TODOS = "SELECT * FROM todos WHERE todolist_id = $1 AND username = $2";

    let todoListResult = dbQuery(FIND_TODOLIST, todoListId, this.username);
    let todosResult = dbQuery(FIND_TODOS, todoListId, this.username);

    let resultBoth = await Promise.all([todoListResult, todosResult]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  };

  _partitionTodoLists(todoLists) {
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));

    return undone.concat(done);
  }

  _partitionTodos(todoList) {
    let undone = todoList.todos.filter(todo => !todo.done);
    let done = todoList.todos.filter(todo => todo.done);

    return undone.concat(done);
  }

  // Set a new title for the specified todo list. Returns `true` on success,
  // `false` if the todo list isn't found. The todo list ID must be numeric.
  async setTodoListTitle(todoListId, newTitle) {
    const CHANGE_LIST_TITLE = `
    UPDATE todolists
    SET title = $2
    WHERE id = $1 AND username = $3
    `;

    let result = await dbQuery(CHANGE_LIST_TITLE, todoListId, newTitle, this.username);
    return result.rowCount > 0;
  }

  // Returns a copy of the list of todo lists sorted by completion status and
  // title (case-insensitive).
  async sortedTodoLists() {
    const ALL_TODOLISTS = "SELECT * FROM todolists" +
                        "  WHERE username = $1" +
                        "  ORDER BY lower(title) ASC";
    const ALL_TODOS =     "SELECT * FROM todos" +
                          "  WHERE username = $1";

    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(ALL_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);

    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    if (!allTodoLists || !allTodos) return undefined;

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });

    return this._partitionTodoLists(allTodoLists);
  }
  
  // Returns a copy of the list of todos in the indicated todo list by sorted by
  // completion status and title (case-insensitive).
  async sortedTodos(todoList) {
    let todoListId = todoList.id;
    const TODOS_ORDERED = `
    SELECT * FROM todos 
    WHERE todolist_id = $1 AND username = $2
    ORDER BY done ASC, lower(title) ASC
    `;

    let results = await dbQuery(TODOS_ORDERED, todoListId, this.username);
    let todos = results.rows;

    return todos;
  }

  // Toggle a todo between the done and not done state. Returns `true` on
  // success, `false` if the todo or todo list doesn't exist. The id arguments
  // must both be numeric.
  async toggleTodo(todoListId, todoId) {
    const TOGGLE_TODO = `
    UPDATE todos
    SET done = NOT done
    WHERE todolist_id = $1 AND id = $2 AND username = $3
    `;

    let result = await dbQuery(TOGGLE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }
};