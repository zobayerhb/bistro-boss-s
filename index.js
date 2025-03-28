require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const corsOptions = {
  origin: ["http://localhost:5173"], // Your frontend URL
  credentials: true, // Allow credentials (cookies)
  optionSuccessStatus: 200,
};

// middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

// JWT VERIFY MIDDLEWARE
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unathorized: No Token Provided" });
  }

  // verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(403).send({ message: "Forviden: Invalid Token" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    const usersCollection = client.db("bistroDB").collection("users");
    const bistroMenuCollection = client.db("bistroDB").collection("menu");
    const bistroReviewCollection = client.db("bistroDB").collection("reviews");
    const cartsCollection = client.db("bistroDB").collection("carts");
    const paymentsCollection = client.db("bistroDB").collection("payments");

    // verify admin usign with middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // ========== JWT =========
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "20d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false, // use true in production with HTTPS
        })
        .send({ message: true });
      // console.log("token sent to cookie ------> ", token);
    });
    // jwt logout api
    app.post("/jwt-logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
        })
        .send({ message: "true" });
    });

    // get menu data
    app.get("/menu", async (req, res) => {
      const filter = await bistroMenuCollection.find().toArray();
      res.send(filter);
    });
    app.get("/menu/:id", async (req, res) => {
      const { id } = req.params;
      console.log("received id:", id);
      const query = { _id: id };
      const result = await bistroMenuCollection.findOne(query);
      console.log("query result", result);
      res.send(result);
    });
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await bistroMenuCollection.insertOne(item);
      res.send(result);
    });
    app.patch("/menu/:id", async (req, res) => {
      const { id } = req.params;
      const item = req.body;
      const filter = { _id: id };
      const updateDoc = {
        $set: {
          name: item.name,
          recipe: item.recipe,
          category: item.category,
          price: item.price,
          image: item.image,
        },
      };
      const result = await bistroMenuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bistroMenuCollection.deleteOne(query);
      res.send(result);
    });

    // get review data
    app.get("/reviews", async (req, res) => {
      const filter = await bistroReviewCollection.find().toArray();
      res.send(filter);
    });

    // ============ ALL USER DATA API ============

    // all user data get
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log("token---->", req.cookies?.token);
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // user data save to database
    app.post("/user", async (req, res) => {
      const user = req.body;

      // check if user email does't have
      const query = { email: user.email };
      const isAxistingEmail = await usersCollection.findOne(query);
      if (isAxistingEmail) {
        return res.send({
          message: "Your Email Already exist",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // =========== MAKE ADMIN API ===========
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    // ========== carts collection ============
    // add to cart data POST api create
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const data = req.body;
      const result = await cartsCollection.insertOne(data);
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(filter);
      res.send(result);
    });

    // ============ STRIPE PAYMENT METHOD INTREGATE ==============
    app.post("/create-payment-intent", async (req, res) => {
      console.log(req.body.item);
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.get("/payments/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.decoded.email) {
        return res.status(403).send("Forbidden access");
      }
      const resutl = await paymentsCollection.find(query).toArray();
      res.send(resutl);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentRes = await paymentsCollection.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await cartsCollection.deleteMany(query);
      res.send({ paymentRes, deleteResult });
    });

    // adimn stat or analytics
    app.get("/admin-stat", verifyToken, verifyAdmin, async (req, res) => {
      const user = await usersCollection.estimatedDocumentCount();
      const products = await bistroMenuCollection.estimatedDocumentCount();
      const orders = await paymentsCollection.estimatedDocumentCount();

      // this is not best way
      // const payments = await paymentsCollection.find().toArray();
      // const revenue = payments.reduce(
      //   (total, payment) => total + payment.price,
      //   0
      // );

      const result = await paymentsCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        user,
        products,
        orders,
        revenue,
      });
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
