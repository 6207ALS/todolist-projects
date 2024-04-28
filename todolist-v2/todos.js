const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");
const store = require("connect-loki");

const app = express();
const HOST = "localhost";
const PORT = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in milliseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secret",
  store: new LokiStore({}),
}));
app.use(flash());
app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Find a todo list with the indicated ID. Returns `undefined` if not found.
// Note that `todoListId` must be numeric.
const loadTodoList = (todoListId, todoLists) => {
  return todoLists.find(todoList => todoList.id === todoListId);
};

const loadTodo = (todoListId, todoId, todoLists) => {
  let todoList = loadTodoList(todoListId, todoLists);
  if (!todoList) return undefined;

  return todoList.todos.find(todo => todo.id === todoId);
};

app.get("/", (req, res) => {
  res.redirect("/lists");
});

app.get("/lists/new", (req, res) => {
  res.render("new-list");
})

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required")
      .bail()
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique"),
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash("error", error.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todo list has been created");
      res.redirect("/lists");
    }
  },
);

// Render individual todo list and its todos
app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadTodoList(Number(todoListId), req.session.todoLists);

  if (todoList === undefined) {
    next(new Error("Not found"));
  } else {
    res.render("list", {
      todoList: todoList,
      todos: sortTodos(todoList),
    });
  }
});

// Toggle the check box for an individual Todo item
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  let todo = loadTodo(Number(todoListId), Number(todoId), req.session.todoLists);

  if (!todo) {
    next(new Error("Not found"));
  } else {
    let title = todo.title;
    if (todo.isDone()) {
      todo.markUndone();
      req.flash("success", `"${title}" marked incomplete!`);
    } else {
      todo.markDone();
      req.flash("success", `"${title}" marked complete!`);
    }
  }

  res.redirect(`/lists/${todoListId}`);
});

// delete an individual Todo item from a TodoList
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let { todoListId, todoId } = { ...req.params };
  let todoList = loadTodoList(Number(todoListId), req.session.todoLists);
  let todo = loadTodo(Number(todoListId), Number(todoId), req.session.todoLists);

  if (!todoList || !todo) {
    next(new Error("Not Found"));
  } else {
    let title = todo.title;
    todoList.removeAt(todoList.findIndexOf(todo));
    req.flash("success", `Removed "${title}!"`);
    res.redirect(`/lists/${todoListId}`);
  }
});

// delete an individual TodoList from the list
app.post("/lists/:todoListId/destroy", (req, res) => {
  let todoLists = req.session.todoLists;
  let todoListId = Number(req.params.todoListId);
  let index = todoLists.findIndex(todoList => todoList.id === todoListId);
  if (index === -1) {
    next(new Error("Not found."));
  } else {
    todoLists.splice(index, 1);

    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
}); 

// mark all Todo items in a TodoList as complete 
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadTodoList(Number(todoListId), req.session.todoLists);

  if (!todoList) {
    next(new Error("Not Found"));
  } else {
    todoList.markAllDone();
    req.flash("success", "Marked all tasks complete!");
    res.redirect(`/lists/${todoListId}`);
  }
}); 

// add a new Todo item to a TodoList
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required")
      .bail()
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique"),
  ],

  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = loadTodoList(Number(todoListId), req.session.todoLists);
    console.log(todoList);

    if (!todoList) {
      next(new Error("Not Found"));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash("error", error.msg));
        res.render("list", {
          flash: req.flash(),
          todoList: todoList,
          todos: sortTodos(todoList),
          todoTitle: req.body.todoTitle,
        });
      } else {
        let title = req.body.todoTitle;
        todoList.add(new Todo(title));
        req.flash("success", "Task added to list!");
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Render edit todo list form
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoList = loadTodoList(Number(todoListId), req.session.todoLists);

  if (!todoList) {
    next(new Error("Not Found"));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Edit todo list title
app.post("/lists/:todoListId/edit", 
  [
    body("todoListTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Title is required!")
    .bail()
    .isLength({ max: 100 })
    .withMessage("Title must be shorter than 100 characters!")
    .custom((title, { req }) => {
      let todoLists = req.session.todoLists;
      let duplicate = todoLists.find(list => list.title === title);
      return duplicate === undefined;
    })
    .withMessage("Title must be unique or different!")
  ],
  (req, res, next) => {
    let todoListId = req.params.todoListId;
    let todoList = loadTodoList(Number(todoListId), req.session.todoLists);

    if (!todoList) {
      next(new Error("Not Found"));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash("error", error.msg));
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle: req.body.todoListTitle,
          todos: sortTodos(todoList),
        });
      } else {
        todoList.setTitle(req.body.todoListTitle);
        req.flash("success", "Todo title changed!");
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Error Handler
app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

// Listener
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT} of ${HOST}...`);
})