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
        
        # Handle empty or null values properly
        gender = data.get('gender', '')
        if gender is None:
            gender = ''
        
        # Ensure gender is a single character (M/F/O)
        if gender and len(gender) > 1:
            # If somehow a full word is sent, convert it
            if gender.lower() == 'male':
                gender = 'M'
            elif gender.lower() == 'female':
                gender = 'F'
            else:
                gender = gender[0].upper()  # Just take the first character
            
        # Handle empty group_id
        group_id = data.get('group_id')
        if not group_id:  # If empty string or None
            group_id = None
            
        # Parse DOB if provided
        dob = None
        if data.get('DOB'):
            try:
                dob = datetime.strptime(data.get('DOB'), '%Y-%m-%d').date()
            except ValueError:
                return jsonify({"error": "Invalid date format for DOB. Use YYYY-MM-DD"}), 400
        
        new_customer = Customer(
            customer_name=data.get('customer_name'),
            customer_type=data.get('customer_type'),
            gender=gender,
            DOB=dob,
            email_id=data.get('email_id'),
            mobile1=data.get('mobile1'),
            mobile2=data.get('mobile2') if data.get('mobile2') else None,
            address=data.get('address'),
            city=data.get('city'),
            pincode=data.get('pincode'),
            country=data.get('country'),
            group_id=group_id,
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
        
        # Update all fields that might be sent from the frontend
        if 'customer_name' in data:
            customer.customer_name = data['customer_name']
        if 'email_id' in data:
            customer.email_id = data['email_id']
        if 'mobile1' in data:
            customer.mobile1 = data['mobile1']
        if 'mobile2' in data:
            customer.mobile2 = data['mobile2']
        if 'address' in data:
            customer.address = data['address']
        if 'city' in data:
            customer.city = data['city']
        if 'pincode' in data:
            customer.pincode = data['pincode']
        if 'country' in data:
            customer.country = data['country']
        if 'group_id' in data:
            customer.group_id = data['group_id']
        if 'status' in data:
            customer.status = data['status']
        
        db.session.commit()
        return jsonify({"message": "Customer updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print("Error:", e)
        return jsonify({"error": str(e)}), 500 