require('dotenv').config()
const express = require(`express`);
const bodyParser = require(`body-parser`);
const mongoose = require(`mongoose`);

const port = 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));
app.set(`view engine`,`ejs`);

// Connect to MongoDB
const url = process.env.MONGODB_URL;
mongoose.connect(url,{useNewUrlParser: true})
.then(()=> console.log("Connected!"));

const Schema = mongoose.Schema;

// Define item schema
const itemSchema = new Schema({
    Item: String
})
const Item = mongoose.model("Item",itemSchema);

// Define list schema
const listSchema = new Schema({
    itemId: String,
    Title: String,
    Items:[itemSchema]
})
const List = mongoose.model("List",listSchema);


// Home route
app.get("/",async (req,res)=>{
    try{
        // Find the first list in the database
        const foundList = await List.find()
        if(foundList.length === 0){
            // If no list is found, create a new list called "Today"
            const firstList = new List({
                Title:"To-Do List",
                Items:[]
            });
            await firstList.save()
            res.redirect("/");
        }else{
            // Render the home template with the first list found,(ALWAYS firsList)
            res.render("home",{title:foundList[0].Title,List:foundList[0],});
        }
    }catch (err) {
        console.error(err);
        res.send(err);
      }
    
})

// Create new item
app.post("/",async (req,res)=>{
    try{
        const itemName = req.body.newTitle;
        const listId = req.body.listId;
        
        // Create a new item and save it to the database    
        const newItem = new Item({
            Item:itemName
        });
        await newItem.save();
        // Find the list by its ID and add the new item to it
        const foundList = await List.findById({_id:listId});
        foundList.Items.push(newItem);
        await foundList.save()
        
        // Create a new list with the same item ID as the new item
        const todoList = new List({
            itemId:newItem._id,
            Title:itemName,
            Items:[]
        });
        await todoList.save()
        .then(()=>{
            //If the list does not have an 'itemId' field, it means it is the initially created list
            if (!foundList.itemId){
                res.redirect("/")
            }else{
                res.redirect("/"+foundList.itemId);
            }
        });
    }catch(err){
        res.send(err);
    } 
})  

// View list by ID
app.get("/:postID",async (req,res)=>{
    try{
        //URL is always Item._id
        const listId = req.params.postID
        const foundList= await List.findOne({itemId:listId});
        res.render("home",{title:foundList.Title,List:foundList});
    }catch (err) {
        res.send(err);
    }
})

// Delete item and its associated lists recursively
app.post("/delete", async (req, res) => {
    try {
        //The _id of the item I want to delete.
        const theitemId = req.body.itemId;
        //The _id of the list where the item is located.
        const listId = req.body.id;
        //First, I am removing the item from the list.
        await List.findOneAndUpdate({ _id: listId }, { $pull: { Items: { _id: theitemId } } });
        //We are finding the list that corresponds to the item we are going to delete (each item has a list that carries its own ID).
        const foundList = await List.findOne({ itemId: theitemId });
        
        //We iterate through the foundList using a for loop. First, we delete the item inside the list
        //  Then, we store the associated list of that item in a variable and delete the item's associated list. 
        //      We repeat this process until there are no items left. Finally, we delete the remaining item and its associated list.
        //By doing this, our database remains clean!
        async function clearDB(foundList){
            for (const element of foundList.Items) {
                await Item.findByIdAndDelete(element._id);
                const secondList = await List.findOne({ itemId: element._id });
                await List.findOneAndDelete({ itemId: element._id });
                clearDB(secondList)
            }
            List.findOneAndDelete({ itemId:foundList.itemId});
            Item.findByIdAndDelete(foundList._id)
        }

        clearDB(foundList);
        //Finally, we delete the item itself and its associated list.
        await Item.findByIdAndDelete(theitemId);
        await List.findOneAndDelete({ itemId: theitemId });

        const updatedList = await List.findById(listId);
        if (!updatedList.itemId) {
        res.redirect("/");
        } else {
        res.redirect("/" + updatedList.itemId);
        }
    }catch (err){
        console.error(err);
        res.send(err);
    }

});
    

app.listen(port,()=>{
    console.log(`server started on port ${port}`)
})