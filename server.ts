import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { ProtoGrpcType } from "./proto/random";
import { RandomHandlers } from "./proto/randomPackage/Random";
import { TodoResponse } from "./proto/randomPackage/TodoResponse";
import { ChatRequest } from "./proto/randomPackage/ChatRequest";
import { ChatResponse } from "./proto/randomPackage/ChatResponse";

const PORT = 3000;
const PROTO_FILE = "./proto/random.proto";

const packageDef = protoloader.loadSync(path.resolve(__dirname, PROTO_FILE));
const grpcObj = grpc.loadPackageDefinition(
  packageDef
) as unknown as ProtoGrpcType;
const randomPackage = grpcObj.randomPackage;

function main() {
  const server = getServer();
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log("Server started on PORT:", port);
    }
  );
}

const todoList: TodoResponse = { todos: [] };
const usersChat = new Map<
  string,
  grpc.ServerDuplexStream<ChatRequest, ChatResponse>
>();

function getServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(randomPackage.Random.service, {
    PingPong: (req, res) => {
      console.log(req.request);
      res(null, { message: "Pong" });
    },
    RandomNumbers: (call) => {
      const { maxVal = 10 } = call.request;

      let runCount = 0;
      const id = setInterval(() => {
        runCount = ++runCount;
        call.write({ num: Math.floor(Math.random() * maxVal) });

        if (runCount >= 10) {
          clearInterval(id);
          call.end();
        }
      }, 500);
    },
    TodoList: (call, callback) => {
      call.on("data", (chunk) => {
        todoList.todos?.push(chunk);
        console.log(chunk);
      });
      call.on("end", () => {
        callback(null, { todos: todoList.todos });
      });
    },
    Chat: (call) => {
      call.on("data", (req) => {
        const username = call.metadata.get("username")[0] as string;
        const msg = req.message;
        console.log(username, ":", req.message);
        for (const [user, userCall] of usersChat) {
          if (username !== user) {
            userCall.write({
              message: msg,
              username: username,
            });
          }
        }

        if (!usersChat.has(username)) {
          usersChat.set(username, call);
        }
      });

      call.on("end", () => {
        const username = call.metadata.get("username")[0] as string;
        usersChat.delete(username);

        //broadcast closing session
        for (const [user, userCall] of usersChat) {
          userCall.write({
            message: "left the chat!",
            username: username,
          });
        }
        console.log(`${username} chat ended!`);
        call.write({
          message: `Connection end! ${username}`,
        });
        call.end();
      });
    },
  } as RandomHandlers);
  return server;
}

main();
