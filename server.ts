import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoloader from "@grpc/proto-loader";
import { ProtoGrpcType } from "./proto/random";
import { RandomHandlers } from "./proto/randomPackage/Random";

const PORT = 3000;
const PROTO_FILE = "./proto/random.proto";

const packageDef = protoloader.loadSync(path.resolve(__dirname, PROTO_FILE));
const grpcObj = grpc.loadPackageDefinition(
  packageDef
) as unknown as ProtoGrpcType;
const randomPackage = grpcObj.randomPackage;

function main() {
  const server = getServer();
  server.bindAsync(`0.0.0.0:${PORT}`,grpc.ServerCredentials.createInsecure(),(err,port)=>{
    if(err) {
        console.error(err);
        return 
    }
    console.log("Server started on PORT:",port)
  })
}

function getServer(): grpc.Server {
  const server = new grpc.Server();
  server.addService(randomPackage.Random.service, {
    PingPong: (req,res) => {
        console.log(req.request)
        res(null,{message:"Pong"})
    },
  } as RandomHandlers);
  return server;
}

main();
