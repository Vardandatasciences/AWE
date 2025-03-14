from flask import Blueprint, jsonify, request
from models import db, Customer
from datetime import datetime

customers_bp = Blueprint('customers', __name__)

@customers_bp.route('/customers', methods=['GET'])
def get_customers():
    try:
        customers = Customer.query.all()
        return jsonify([customer.to_dict() for customer in customers])
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/customers_assign', methods=['GET'])
def get_customers_assign():
    try:
        customers = Customer.query.with_entities(Customer.customer_name).all()
        return jsonify([{"customer_name": customer.customer_name} for customer in customers])
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/add_customer', methods=['POST'])
def add_customer():
    try:
        data = request.json
        
        # Ensure required fields are present
        if not data.get('customer_name') or not data.get('email_id') or not data.get('mobile1'):
            return jsonify({"error": "Missing required fields"}), 400
        
        new_customer = Customer(
            customer_name=data.get('customer_name'),
            customer_type=data.get('customer_type'),
            gender=data.get('gender'),
            DOB=datetime.strptime(data.get('DOB'), '%Y-%m-%d').date() if data.get('DOB') else None,
            email_id=data.get('email_id'),
            mobile1=data.get('mobile1'),
            mobile2=data.get('mobile2'),
            address=data.get('address'),
            city=data.get('city'),
            pincode=data.get('pincode'),
            country=data.get('country'),
            group_id=data.get('group_id'),
            status=data.get('status')
        )
        
        db.session.add(new_customer)
        db.session.commit()
        
        return jsonify({"message": "Customer added successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/delete_customer/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        db.session.delete(customer)
        db.session.commit()
        return jsonify({"message": "Customer deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@customers_bp.route('/update_customer', methods=['PUT'])
def update_customer():
    try:
        data = request.json
        customer = Customer.query.get_or_404(data['customer_id'])
        
        customer.customer_name = data['customer_name']
        customer.email_id = data['email_id']
        customer.group_id = data['group_id']
        customer.mobile1 = data['mobile1']
        customer.address = data['address']
        customer.city = data['city']
        customer.pincode = data['pincode']
        
        db.session.commit()
        return jsonify({"message": "Customer updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500 