require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vpupb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const bistroMenuCollection = client.db("bistroDB").collection("menu");
    const bistroReviewCollection = client.db("bistroDB").collection("reviews");

    // get menu data
    app.get("/menu", async (req, res) => {
      const filter = await bistroMenuCollection.find().toArray();
      res.send(filter);
    });

    // get review data
    app.get("/reviews", async (req, res) => {
      const filter = await bistroReviewCollection.find().toArray();
      res.send(filter);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Bistro Boss api.......");
});
app.listen(port, async () => {
  console.log(`Bistro Boss Running On Port ${port}`);
});
