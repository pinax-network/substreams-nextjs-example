"use client"
import useSWR from "swr";
import { useState } from "react"
import { fetchSubstream, createRegistry, createRequest } from "@substreams/core";
import { Package as ProtoPackage, SessionInit } from "@substreams/core/proto";
import { createWebTransport } from "@substreams/node/createWebTransport";
import { BlockEmitter } from "@substreams/node";
import { EntityChanges } from "@substreams/sink-entity-changes/entity_pb";

export default function Page() {
  // User parameters
  const manifest = "https://spkg.io/pinax-network/erc20-balance-changes-mainnet-v1.2.0.spkg";

  const [apiToken, setApiToken] = useState<string>("e201fb26657b610dab0df9b557c7e145057deefafba5aae3");
  const { data } = useSWR("manifest", async () => {
    const substreamPackage = await fetchSubstream(manifest, {mode: "cors", headers: {
      'Access-Control-Allow-Origin': "*"
    }});
    if (!substreamPackage.modules) {
      throw new Error("No modules found in substream package");
    }
    return substreamPackage;
  })

  return (
    <>
    <h1>
      @substreams/node
    </h1>
      <span>Substreams API Key:</span><br/>
      <div>
        <input type="password" style={{fontSize: "14px"}} value={apiToken} size={35} onChange={(e) => setApiToken(e.target.value)}>
        </input>
      </div>
      <br/>
      <div><b>Manifest:</b> {manifest}</div>
      {/* <p>{apiToken}</p> */}
      {data ? <SubstreamPackage substreamPackage={data} apiToken={apiToken} /> : <><br/>Loading... ⌛️</>}
    </>
  );
}

function SubstreamPackage({substreamPackage, apiToken}: {substreamPackage: ProtoPackage, apiToken: string}) {
  const [started, setStart] = useState(false);
  const [session, setSession] = useState<SessionInit>();
  const [messages, setMessages] = useState<EntityChanges[]>([]);

  let doc = ''
  let network = substreamPackage.network
  for ( const moduleMeta of substreamPackage.moduleMeta) {
    if ( moduleMeta.doc ) doc = moduleMeta.doc
  }

  // const token = process.env.SUBSTREAMS_API_TOKEN;
  const baseUrl = "https://eth.substreams.pinax.network:443";
  const outputModule = "graph_out";
  const startBlockNum = -5;

  // Connect Transport
  const headers = new Headers({ "X-User-Agent": "@substreams/node", "x-api-key": apiToken });
  const registry = createRegistry(substreamPackage);
  const transport = createWebTransport(baseUrl, apiToken, registry, headers);
  const request = createRequest({
    substreamPackage,
    outputModule,
    startBlockNum,
  });

  if ( !started ) {
    const emitter = new BlockEmitter(transport, request, registry);

    // Session Trace ID
    emitter.on("session", (session) => {
      console.dir(session);
      setSession(session);
    });

    // Stream Blocks
    emitter.on("anyMessage", (message: any, cursor, clock) => {
      console.dir(clock);
      console.dir(message.entityChanges);
      console.dir(cursor);
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    emitter.start()
    setStart(true)
  }
  const entities = messages.reduce((prev, current) => {
    return prev + current.entityChanges.length
  }, 0);
  return (
    <>
    <h3>{doc}</h3>
    <div><b>Network:</b> {network}</div>
    <div><b>Base URL:</b> {baseUrl}</div>
    <div><b>Trace ID:</b> {session ? session.traceId.toString() : "Connecting... 🔌"}</div>
    <div><b>Max Workers:</b> {session ? session.maxParallelWorkers.toString() : "Connecting... 🔌"}</div>
    <div><b>Start Block:</b> {session ? session.resolvedStartBlock.toString() : "Connecting... 🔌"}</div>
    <div><b>Blocks:</b> {messages.length ? messages.length : "Loading... ⌛️"}</div>
    <div><b>Entities Changes:</b> {messages.length ? entities : "Loading... ⌛️"}</div>
    <div style={{color: "navy"}}>{messages.length ? "<Open Console Log>" : ""}</div>


    <h3>Preview Message</h3>
    <code>
      <pre>
        {messages.length ? JSON.stringify(messages[0], null, 2) : ''}
      </pre>
    </code>
    </>
  )
}
