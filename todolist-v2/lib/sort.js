// Compare object titles alphabetically (case-insensitive)
const compareByTitle = (todoA, todoB) => {
  if (todoA < todoB) {
    return -1;
  } else if (todoA > todoB) {
    return 1
  } else {
    return 0;
  }
}

// return the list of todo lists sorted by completion status and title
const sortTodoLists = lists => {
  let done = lists.filter(todoList => todoList.isDone());
  let notDone = lists.filter(todoList => !todoList.isDone()); 

  done.sort(compareByTitle);
  notDone.sort(compareByTitle);

  return [...notDone, ...done];
};

// sort a list of todos
const sortTodos = todoList => {
  let done = todoList.toArray().filter(todo => todo.isDone());
  let notDone = todoList.toArray().filter(todo => !todo.isDone());

  done.sort(compareByTitle);
  notDone.sort(compareByTitle);

  return [...notDone, ...done];
}

module.exports = {
  sortTodoLists,
  sortTodos
}