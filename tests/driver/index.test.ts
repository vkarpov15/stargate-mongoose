import mongoose from 'mongoose';
import { astraUri } from '@/tests/fixtures';
import * as astraMongooseDriver from '@/src/driver';

// @ts-ignore
mongoose.driver.set(astraMongooseDriver);
// @ts-ignore
mongoose.Connection = astraMongooseDriver.getConnection();
// @ts-ignore
mongoose.Collection = astraMongooseDriver.Collection;
// @ts-ignore
mongoose.connections = [new mongoose.Connection(mongoose)];

const cartSchema = new mongoose.Schema({
  name: String,
  cartName: { type: String, lowercase: true, unique: true, index: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number
});

const Cart = mongoose.model('Cart', cartSchema);
const Product = mongoose.model('Product', productSchema);

describe('AstraMongoose - index', () => {
  it('should leverage astradb', async () => {
    await mongoose.connect(astraUri);

    const product1 = new Product({ name: 'Product 1', price: 10 });
    await product1.save();

    const product2 = new Product({ name: 'Product 2', price: 10 });
    await product2.save();

    const cart = new Cart({
      name: 'My Cart',
      cartName: 'wewson',
      products: [product1._id, product2._id]
    });
    await cart.save();

    // const res = await Cart.findOne({ name: { $eq: 'My Cart' } })
    //   .populate('products')
    //   .exec();
    // console.log(res);

    // const count = await Cart.find({
    //   name: { $eq: 'My Cart' }
    // }).countDocuments();
    // console.log(count);

    mongoose.connection.dropCollection('carts');
    mongoose.connection.dropCollection('products');
  });
});