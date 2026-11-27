interface D1Result<T=unknown>{results:T[];success:boolean;meta:{changes:number;duration:number;last_row_id?:number};}
interface D1PreparedStatement{bind(...values:unknown[]):D1PreparedStatement;all<T=Record<string,unknown>>():Promise<D1Result<T>>;first<T=Record<string,unknown>>():Promise<T|null>;run<T=unknown>():Promise<D1Result<T>>;}
interface D1Database{prepare(query:string):D1PreparedStatement;batch<T=unknown>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;exec(query:string):Promise<D1Result>;}
interface Fetcher{fetch(input:Request|string|URL,init?:RequestInit):Promise<Response>;}
interface ExecutionContext{waitUntil(promise:Promise<unknown>):void;passThroughOnException():void;}
interface ExportedHandler<Env=unknown>{fetch?(request:Request,env:Env,ctx:ExecutionContext):Response|Promise<Response>;}